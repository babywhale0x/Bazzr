module verixa::storage {
    use std::string::{String, utf8};
    use std::vector;
    use std::signer;
    use std::bcs;
    use aptos_framework::account;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::timestamp;
    use aptos_framework::event;
    use aptos_std::table::{Self, Table};

    // Error codes
    const E_INSUFFICIENT_BALANCE: u64 = 1;
    const E_FILE_NOT_FOUND: u64 = 2;
    const E_GRACE_PERIOD_EXPIRED: u64 = 3;
    const E_UNAUTHORIZED: u64 = 4;
    const E_INVALID_SIZE: u64 = 5;
    const E_USER_NOT_REGISTERED: u64 = 6;

    // Constants
    const BYTES_PER_GB: u64 = 1073741824;
    const COST_PER_GB_MONTH_OCTAS: u64 = 100000; // 0.001 APT = ~$0.01 at $10/APT
    const SECONDS_PER_MONTH: u64 = 2592000; // 30 days
    const GRACE_PERIOD_SECONDS: u64 = 2592000; // 30 days grace period

    // Events
    #[event]
    struct UserRegistered has drop, store {
        user: address,
        timestamp: u64,
    }

    #[event]
    struct FileAdded has drop, store {
        user: address,
        blob_id: String,
        size_bytes: u64,
        is_encrypted: bool,
        timestamp: u64,
    }

    #[event]
    struct FileRemoved has drop, store {
        user: address,
        blob_id: String,
        timestamp: u64,
    }

    #[event]
    struct StorageFunded has drop, store {
        user: address,
        amount: u64,
        new_balance: u64,
        timestamp: u64,
    }

    #[event]
    struct AutoDeduction has drop, store {
        user: address,
        amount: u64,
        months_covered: u64,
        timestamp: u64,
    }

    #[event]
    struct GracePeriodStarted has drop, store {
        user: address,
        grace_period_end: u64,
        timestamp: u64,
    }

    // Structs
    struct StorageFile has key, store, drop, copy {
        blob_id: String,
        owner: address,
        size_bytes: u64,
        upload_timestamp: u64,
        last_payment_timestamp: u64,
        is_public: bool,
        is_encrypted: bool,
        encryption_key_hash: vector<u8>, // Hash only, not the actual key
        content_type: String,
        name: String,
        is_active: bool,
    }

    struct UserStorage has key {
        owner: address,
        files: Table<String, StorageFile>,
        total_bytes: u64,
        wallet_balance: u64,
        last_deduction_timestamp: u64,
        grace_period_start: u64, // 0 if not in grace period
        is_active: bool,
    }

    struct StorageConfig has key {
        platform_wallet: address,
        cost_per_gb_month: u64,
        grace_period_seconds: u64,
        min_file_size: u64,
        max_file_size: u64,
        total_storage_reserved: u64,
        total_revenue: u64,
    }

    struct StorageRegistry has key {
        users: Table<address, bool>,
        total_users: u64,
    }

    // Initialization
    fun init_module(creator: &signer) {
        let creator_addr = signer::address_of(creator);

        move_to(creator, StorageConfig {
            platform_wallet: creator_addr,
            cost_per_gb_month: COST_PER_GB_MONTH_OCTAS,
            grace_period_seconds: GRACE_PERIOD_SECONDS,
            min_file_size: 1, // 1 byte minimum
            max_file_size: 10737418240, // 10GB max per file
            total_storage_reserved: 0,
            total_revenue: 0,
        });

        move_to(creator, StorageRegistry {
            users: table::new(),
            total_users: 0,
        });
    }

    // Public entry functions

    /// Register a new storage user
    public entry fun register_user(user: &signer) acquires StorageRegistry {
        let user_addr = signer::address_of(user);
        let registry = borrow_global_mut<StorageRegistry>(@verixa);

        if (!table::contains(&registry.users, user_addr)) {
            table::add(&mut registry.users, user_addr, true);
            registry.total_users = registry.total_users + 1;
        };

        if (!exists<UserStorage>(user_addr)) {
            move_to(user, UserStorage {
                owner: user_addr,
                files: table::new(),
                total_bytes: 0,
                wallet_balance: 0,
                last_deduction_timestamp: timestamp::now_seconds(),
                grace_period_start: 0,
                is_active: true,
            });

            event::emit(UserRegistered {
                user: user_addr,
                timestamp: timestamp::now_seconds(),
            });
        };
    }

    /// Fund storage wallet with APT
    public entry fun fund_wallet(
        user: &signer,
        amount: u64,
    ) acquires UserStorage, StorageConfig {
        let user_addr = signer::address_of(user);
        assert!(exists<UserStorage>(user_addr), E_USER_NOT_REGISTERED);

        let config = borrow_global<StorageConfig>(@verixa);
        let storage = borrow_global_mut<UserStorage>(user_addr);

        // Transfer from user to platform (then credited to their storage account)
        coin::transfer<AptosCoin>(user, config.platform_wallet, amount);

        storage.wallet_balance = storage.wallet_balance + amount;

        // If in grace period, check if funding clears it
        if (storage.grace_period_start > 0) {
            let monthly_cost = calculate_monthly_cost(storage.total_bytes);
            if (storage.wallet_balance >= monthly_cost) {
                storage.grace_period_start = 0;
                storage.last_deduction_timestamp = timestamp::now_seconds();
            };
        };

        event::emit(StorageFunded {
            user: user_addr,
            amount,
            new_balance: storage.wallet_balance,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Add a new file to storage
    public entry fun add_file(
        user: &signer,
        blob_id: String,
        size_bytes: u64,
        is_encrypted: bool,
        encryption_key_hash: vector<u8>,
        content_type: String,
        name: String,
    ) acquires UserStorage, StorageConfig {
        let user_addr = signer::address_of(user);
        assert!(exists<UserStorage>(user_addr), E_USER_NOT_REGISTERED);

        let config = borrow_global<StorageConfig>(@verixa);
        assert!(size_bytes >= config.min_file_size && size_bytes <= config.max_file_size, E_INVALID_SIZE);

        let storage = borrow_global_mut<UserStorage>(user_addr);

        // Check if file already exists
        if (table::contains(&storage.files, blob_id)) {
            // Update existing file
            let file = table::borrow_mut(&mut storage.files, blob_id);
            let old_size = file.size_bytes;
            file.size_bytes = size_bytes;
            file.is_encrypted = is_encrypted;
            file.encryption_key_hash = encryption_key_hash;
            file.content_type = content_type;
            file.name = name;
            storage.total_bytes = storage.total_bytes - old_size + size_bytes;
        } else {
            // New file
            let monthly_cost = calculate_monthly_cost_for_size(size_bytes);
            assert!(storage.wallet_balance >= monthly_cost, E_INSUFFICIENT_BALANCE);

            let file = StorageFile {
                blob_id,
                owner: user_addr,
                size_bytes,
                upload_timestamp: timestamp::now_seconds(),
                last_payment_timestamp: timestamp::now_seconds(),
                is_public: false,
                is_encrypted,
                encryption_key_hash,
                content_type,
                name,
                is_active: true,
            };

            table::add(&mut storage.files, blob_id, file);
            storage.total_bytes = storage.total_bytes + size_bytes;

            // Deduct first month immediately
            storage.wallet_balance = storage.wallet_balance - monthly_cost;

            // Update global stats
            let config_mut = borrow_global_mut<StorageConfig>(@verixa);
            config_mut.total_storage_reserved = config_mut.total_storage_reserved + size_bytes;
            config_mut.total_revenue = config_mut.total_revenue + monthly_cost;

            event::emit(FileAdded {
                user: user_addr,
                blob_id,
                size_bytes,
                is_encrypted,
                timestamp: timestamp::now_seconds(),
            });
        };
    }

    /// Remove a file from storage
    public entry fun remove_file(
        user: &signer,
        blob_id: String,
    ) acquires UserStorage, StorageConfig {
        let user_addr = signer::address_of(user);
        assert!(exists<UserStorage>(user_addr), E_USER_NOT_REGISTERED);

        let storage = borrow_global_mut<UserStorage>(user_addr);
        assert!(table::contains(&storage.files, blob_id), E_FILE_NOT_FOUND);

        let file = table::borrow(&storage.files, blob_id);
        assert!(file.owner == user_addr, E_UNAUTHORIZED);

        let size = file.size_bytes;
        table::remove(&mut storage.files, blob_id);
        storage.total_bytes = storage.total_bytes - size;

        // Update global stats
        let config = borrow_global_mut<StorageConfig>(@verixa);
        config.total_storage_reserved = config.total_storage_reserved - size;

        event::emit(FileRemoved {
            user: user_addr,
            blob_id,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Make file public (for sharing)
    public entry fun make_file_public(
        user: &signer,
        blob_id: String,
    ) acquires UserStorage {
        let user_addr = signer::address_of(user);
        let storage = borrow_global_mut<UserStorage>(user_addr);

        assert!(table::contains(&storage.files, blob_id), E_FILE_NOT_FOUND);
        let file = table::borrow_mut(&mut storage.files, blob_id);
        assert!(file.owner == user_addr, E_UNAUTHORIZED);

        file.is_public = true;
    }

    /// Make file private
    public entry fun make_file_private(
        user: &signer,
        blob_id: String,
    ) acquires UserStorage {
        let user_addr = signer::address_of(user);
        let storage = borrow_global_mut<UserStorage>(user_addr);

        assert!(table::contains(&storage.files, blob_id), E_FILE_NOT_FOUND);
        let file = table::borrow_mut(&mut storage.files, blob_id);
        assert!(file.owner == user_addr, E_UNAUTHORIZED);

        file.is_public = false;
    }

    /// Process auto-deductions for multiple users (called by cron job)
    public entry fun process_deductions(
    _processor: &signer,
    users: vector<address>,
) acquires UserStorage, StorageConfig {
    let current_time = timestamp::now_seconds();
    let grace_period_seconds = borrow_global<StorageConfig>(@verixa).grace_period_seconds;
    let i = 0;

    while (i < vector::length(&users)) {
        let user_addr = *vector::borrow(&users, i);

        if (exists<UserStorage>(user_addr)) {
            let storage = borrow_global_mut<UserStorage>(user_addr);
            let seconds_since_last = current_time - storage.last_deduction_timestamp;

            if (seconds_since_last >= SECONDS_PER_MONTH && storage.total_bytes > 0) {
                let monthly_cost = calculate_monthly_cost(storage.total_bytes);

                if (storage.wallet_balance >= monthly_cost) {
                    storage.wallet_balance = storage.wallet_balance - monthly_cost;
                    storage.last_deduction_timestamp = current_time;
                    storage.grace_period_start = 0;

                    let config_mut = borrow_global_mut<StorageConfig>(@verixa);
                    config_mut.total_revenue = config_mut.total_revenue + monthly_cost;

                    event::emit(AutoDeduction {
                        user: user_addr,
                        amount: monthly_cost,
                        months_covered: 1,
                        timestamp: current_time,
                    });
                } else {
                    if (storage.grace_period_start == 0) {
                        storage.grace_period_start = current_time;

                        event::emit(GracePeriodStarted {
                            user: user_addr,
                            grace_period_end: current_time + grace_period_seconds,
                            timestamp: current_time,
                        });
                    };
                };
            };
        };

        i = i + 1;
    };
}

    /// Admin: Update storage pricing
    public entry fun update_pricing(
        admin: &signer,
        new_cost_per_gb_month: u64,
    ) acquires StorageConfig {
        let admin_addr = signer::address_of(admin);
        let config = borrow_global_mut<StorageConfig>(@verixa);

        assert!(admin_addr == config.platform_wallet, E_UNAUTHORIZED);
        config.cost_per_gb_month = new_cost_per_gb_month;
    }

    // View functions

    #[view]
    public fun get_user_storage(user: address): (u64, u64, u64, u64, bool) acquires UserStorage {
        if (!exists<UserStorage>(user)) {
            return (0, 0, 0, 0, false)
        };

        let storage = borrow_global<UserStorage>(user);
        let monthly_cost = calculate_monthly_cost(storage.total_bytes);
        let months_remaining = if (monthly_cost > 0) {
            storage.wallet_balance / monthly_cost
        } else {
            0
        };

        let in_grace = storage.grace_period_start > 0 && 
                      (timestamp::now_seconds() - storage.grace_period_start) < GRACE_PERIOD_SECONDS;

        (storage.total_bytes, storage.wallet_balance, monthly_cost, months_remaining, in_grace)
    }

    #[view]
    public fun get_file_details(user: address, blob_id: String): StorageFile acquires UserStorage {
        let storage = borrow_global<UserStorage>(user);
        assert!(table::contains(&storage.files, blob_id), E_FILE_NOT_FOUND);
        *table::borrow(&storage.files, blob_id)
    }

    #[view]
    public fun get_user_files(user: address): vector<StorageFile> acquires UserStorage {
        if (!exists<UserStorage>(user)) {
            return vector::empty()
        };

        let storage = borrow_global<UserStorage>(user);
        let files = vector::empty<StorageFile>();

        // Note: In production, implement pagination
        // This is a simplified version

        files
    }

    #[view]
    public fun is_file_accessible(user: address, blob_id: String): bool acquires UserStorage, StorageConfig {
        if (!exists<UserStorage>(user)) {
            return false
        };

        let storage = borrow_global<UserStorage>(user);
        if (!table::contains(&storage.files, blob_id)) {
            return false
        };

        let file = table::borrow(&storage.files, blob_id);
        let config = borrow_global<StorageConfig>(@verixa);
        let current_time = timestamp::now_seconds();

        // Check if within payment period or grace period
        let seconds_since_payment = current_time - file.last_payment_timestamp;
        let in_grace = storage.grace_period_start > 0 && 
                      (current_time - storage.grace_period_start) < config.grace_period_seconds;

        (seconds_since_payment < SECONDS_PER_MONTH) || in_grace || file.is_public
    }

    #[view]
    public fun calculate_storage_cost(size_bytes: u64, months: u64): u64 {
        let gb = (size_bytes + BYTES_PER_GB - 1) / BYTES_PER_GB; // Round up
        gb * COST_PER_GB_MONTH_OCTAS * months
    }

    #[view]
    public fun get_platform_storage_stats(): (u64, u64, u64) acquires StorageConfig, StorageRegistry {
        let config = borrow_global<StorageConfig>(@verixa);
        let registry = borrow_global<StorageRegistry>(@verixa);
        (config.total_storage_reserved, registry.total_users, config.total_revenue)
    }

    #[view]
public fun get_config(): (u64, u64, u64) acquires StorageConfig {
    let config = borrow_global<StorageConfig>(@verixa);
    (config.cost_per_gb_month, config.grace_period_seconds, config.total_revenue)
}

    // Helper functions

    fun calculate_monthly_cost(total_bytes: u64): u64 {
        if (total_bytes == 0) {
            return 0
        };
        let gb = (total_bytes + BYTES_PER_GB - 1) / BYTES_PER_GB; // Round up
        gb * COST_PER_GB_MONTH_OCTAS
    }

    fun calculate_monthly_cost_for_size(size_bytes: u64): u64 {
        if (size_bytes == 0) {
            return 0
        };
        let gb = (size_bytes + BYTES_PER_GB - 1) / BYTES_PER_GB;
        gb * COST_PER_GB_MONTH_OCTAS
    }

    fun update_file_payment_timestamps(storage: &mut UserStorage, timestamp: u64) {
        // In production, iterate through files and update timestamps
        // This is a simplified placeholder
    }

    #[test_only]
    public fun init_for_test(creator: &signer) {
        init_module(creator);
    }
}
