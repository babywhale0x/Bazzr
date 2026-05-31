module verixa::marketplace {
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
    use aptos_std::hash;

    // Error codes
    const E_NOT_CREATOR: u64 = 1;
    const E_INVALID_PRICE: u64 = 2;
    const E_CONTENT_NOT_FOUND: u64 = 3;
    const E_ALREADY_PURCHASED: u64 = 4;
    const E_INSUFFICIENT_BALANCE: u64 = 5;
    const E_INVALID_ACCESS_TIER: u64 = 6;
    const E_UNAUTHORIZED: u64 = 7;
    const E_SUBSCRIPTION_EXPIRED: u64 = 8;

    // Access tiers
    const TIER_FREE: u8 = 0;
    const TIER_VIEW: u8 = 1;
    const TIER_BORROW: u8 = 2;
    const TIER_LICENSE: u8 = 3;
    const TIER_COMMERCIAL: u8 = 4;
    const TIER_SUBSCRIPTION: u8 = 5;

    // Platform fee: 10% (1000 basis points)
    const PLATFORM_FEE_BPS: u64 = 1000;
    const BASIS_POINTS: u64 = 10000;

    // Time constants (in seconds)
    const SECONDS_PER_DAY: u64 = 86400;
    const VIEW_DURATION: u64 = 86400;        // 24 hours
    const BORROW_DURATION: u64 = 604800;      // 7 days

    // Core structs
    struct Content has key, store, drop, copy {
        content_id: u64,
        creator: address,
        title: String,
        description: String,
        content_type: String,
        walrus_blob_id: String,
        walrus_root_hash: vector<u8>,
        upload_timestamp: u64,
        is_active: bool,
        // Pricing (in octas - smallest APT unit)
        view_price: u64,
        borrow_price: u64,
        license_price: u64,
        commercial_price: u64,
        subscription_price: u64,
        // Metadata
        preview_blob_id: String,
        tags: vector<String>,
        collection_id: u64,
    }

    struct ContentRegistry has key {
        contents: Table<u64, Content>,
        next_content_id: u64,
        creator_contents: Table<address, vector<u64>>,
        content_count: u64,
    }

    struct Purchase has key, store, drop, copy {
        purchase_id: u64,
        buyer: address,
        content_id: u64,
        tier: u8,
        purchase_timestamp: u64,
        expiry_timestamp: u64,
        license_hash: vector<u8>,
        amount_paid: u64,
        is_active: bool,
    }

    struct PurchaseRegistry has key {
        purchases: Table<u64, Purchase>,
        user_purchases: Table<address, vector<u64>>,
        content_purchases: Table<u64, vector<u64>>,
        next_purchase_id: u64,
    }

    struct PlatformConfig has key {
        platform_wallet: address,
        fee_bps: u64,
        total_volume: u64,
        total_transactions: u64,
        is_paused: bool,
    }

    struct CreatorStats has key, store {
        creator: address,
        total_contents: u64,
        total_sales: u64,
        total_earnings: u64,
        subscriber_count: u64,
    }

    struct StatsRegistry has key {
        creators: Table<address, CreatorStats>,
    }

    // Events
    #[event]
    struct ContentPublished has drop, store {
        content_id: u64,
        creator: address,
        title: String,
        content_type: String,
        timestamp: u64,
    }

    #[event]
    struct ContentPurchased has drop, store {
        purchase_id: u64,
        content_id: u64,
        buyer: address,
        creator: address,
        tier: u8,
        amount: u64,
        platform_fee: u64,
        creator_amount: u64,
        timestamp: u64,
    }

    #[event]
    struct ContentUpdated has drop, store {
        content_id: u64,
        creator: address,
        timestamp: u64,
    }

    #[event]
    struct ContentDeactivated has drop, store {
        content_id: u64,
        creator: address,
        timestamp: u64,
    }

    // Initialization
    fun init_module(creator: &signer) {
        let creator_addr = signer::address_of(creator);

        move_to(creator, ContentRegistry {
            contents: table::new(),
            next_content_id: 1,
            creator_contents: table::new(),
            content_count: 0,
        });

        move_to(creator, PurchaseRegistry {
            purchases: table::new(),
            user_purchases: table::new(),
            content_purchases: table::new(),
            next_purchase_id: 1,
        });

        move_to(creator, PlatformConfig {
            platform_wallet: creator_addr,
            fee_bps: PLATFORM_FEE_BPS,
            total_volume: 0,
            total_transactions: 0,
            is_paused: false,
        });

        move_to(creator, StatsRegistry {
            creators: table::new(),
        });
    }

    // Public entry functions

    /// Publish new content to the marketplace
    public entry fun publish_content(
        creator: &signer,
        title: String,
        description: String,
        content_type: String,
        walrus_blob_id: String,
        walrus_root_hash: vector<u8>,
        preview_blob_id: String,
        view_price: u64,
        borrow_price: u64,
        license_price: u64,
        commercial_price: u64,
        subscription_price: u64,
        tags: vector<String>,
        collection_id: u64,
    ) acquires ContentRegistry, StatsRegistry {
        let creator_addr = signer::address_of(creator);
        let registry = borrow_global_mut<ContentRegistry>(@verixa);
        let content_id = registry.next_content_id;

        let content = Content {
            content_id,
            creator: creator_addr,
            title,
            description,
            content_type,
            walrus_blob_id,
            walrus_root_hash,
            upload_timestamp: timestamp::now_seconds(),
            is_active: true,
            view_price,
            borrow_price,
            license_price,
            commercial_price,
            subscription_price,
            preview_blob_id,
            tags,
            collection_id,
        };

        table::add(&mut registry.contents, content_id, content);
        registry.next_content_id = content_id + 1;
        registry.content_count = registry.content_count + 1;

        // Add to creator's content list
        if (!table::contains(&registry.creator_contents, creator_addr)) {
            table::add(&mut registry.creator_contents, creator_addr, vector::empty());
        };
        let creator_list = table::borrow_mut(&mut registry.creator_contents, creator_addr);
        vector::push_back(creator_list, content_id);

        // Update creator stats
        update_creator_stats(creator_addr, 1, 0, 0);

        event::emit(ContentPublished {
            content_id,
            creator: creator_addr,
            title,
            content_type,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Purchase access to content
    public entry fun purchase_access(
        buyer: &signer,
        content_id: u64,
        tier: u8,
    ) acquires ContentRegistry, PurchaseRegistry, PlatformConfig, StatsRegistry {
        let buyer_addr = signer::address_of(buyer);
        let config = borrow_global<PlatformConfig>(@verixa);

        assert!(!config.is_paused, E_UNAUTHORIZED);

        let content_registry = borrow_global<ContentRegistry>(@verixa);
        assert!(table::contains(&content_registry.contents, content_id), E_CONTENT_NOT_FOUND);

        let content = table::borrow(&content_registry.contents, content_id);
        assert!(content.is_active, E_CONTENT_NOT_FOUND);

        // Determine price and expiry based on tier
        let (price, expiry) = get_tier_details(content, tier);
        assert!(price > 0, E_INVALID_ACCESS_TIER);

        // Calculate fees
        let platform_fee = (price * config.fee_bps) / BASIS_POINTS;
        let creator_amount = price - platform_fee;

        // Process payments
        coin::transfer<AptosCoin>(buyer, config.platform_wallet, platform_fee);
        coin::transfer<AptosCoin>(buyer, content.creator, creator_amount);

        // Record purchase
        let purchase_registry = borrow_global_mut<PurchaseRegistry>(@verixa);
        let purchase_id = purchase_registry.next_purchase_id;

        let license_hash = generate_license_hash(buyer_addr, content_id, tier, purchase_id);

        let purchase = Purchase {
            purchase_id,
            buyer: buyer_addr,
            content_id,
            tier,
            purchase_timestamp: timestamp::now_seconds(),
            expiry_timestamp: expiry,
            license_hash,
            amount_paid: price,
            is_active: true,
        };

        table::add(&mut purchase_registry.purchases, purchase_id, purchase);
        purchase_registry.next_purchase_id = purchase_id + 1;

        // Add to user's purchases
        if (!table::contains(&purchase_registry.user_purchases, buyer_addr)) {
            table::add(&mut purchase_registry.user_purchases, buyer_addr, vector::empty());
        };
        let user_list = table::borrow_mut(&mut purchase_registry.user_purchases, buyer_addr);
        vector::push_back(user_list, purchase_id);

        // Add to content's purchases
        if (!table::contains(&purchase_registry.content_purchases, content_id)) {
            table::add(&mut purchase_registry.content_purchases, content_id, vector::empty());
        };
        let content_list = table::borrow_mut(&mut purchase_registry.content_purchases, content_id);
        vector::push_back(content_list, purchase_id);

        // Update platform stats
        let config_mut = borrow_global_mut<PlatformConfig>(@verixa);
        config_mut.total_volume = config_mut.total_volume + price;
        config_mut.total_transactions = config_mut.total_transactions + 1;

        // Update creator stats
        update_creator_stats(content.creator, 0, 1, creator_amount);

        event::emit(ContentPurchased {
            purchase_id,
            content_id,
            buyer: buyer_addr,
            creator: content.creator,
            tier,
            amount: price,
            platform_fee,
            creator_amount,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Update content pricing or metadata
    public entry fun update_content(
        creator: &signer,
        content_id: u64,
        title: String,
        description: String,
        view_price: u64,
        borrow_price: u64,
        license_price: u64,
        commercial_price: u64,
        subscription_price: u64,
        is_active: bool,
    ) acquires ContentRegistry {
        let creator_addr = signer::address_of(creator);
        let registry = borrow_global_mut<ContentRegistry>(@verixa);

        assert!(table::contains(&registry.contents, content_id), E_CONTENT_NOT_FOUND);
        let content = table::borrow_mut(&mut registry.contents, content_id);
        assert!(content.creator == creator_addr, E_NOT_CREATOR);

        content.title = title;
        content.description = description;
        content.view_price = view_price;
        content.borrow_price = borrow_price;
        content.license_price = license_price;
        content.commercial_price = commercial_price;
        content.subscription_price = subscription_price;
        content.is_active = is_active;

        event::emit(ContentUpdated {
            content_id,
            creator: creator_addr,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Deactivate content
    public entry fun deactivate_content(
        creator: &signer,
        content_id: u64,
    ) acquires ContentRegistry {
        let creator_addr = signer::address_of(creator);
        let registry = borrow_global_mut<ContentRegistry>(@verixa);

        assert!(table::contains(&registry.contents, content_id), E_CONTENT_NOT_FOUND);
        let content = table::borrow_mut(&mut registry.contents, content_id);
        assert!(content.creator == creator_addr, E_NOT_CREATOR);

        content.is_active = false;

        event::emit(ContentDeactivated {
            content_id,
            creator: creator_addr,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Admin: Update platform fee
    public entry fun update_platform_fee(
        admin: &signer,
        new_fee_bps: u64,
    ) acquires PlatformConfig {
        let admin_addr = signer::address_of(admin);
        let config = borrow_global_mut<PlatformConfig>(@verixa);

        assert!(admin_addr == config.platform_wallet, E_UNAUTHORIZED);
        assert!(new_fee_bps <= 2000, E_INVALID_PRICE); // Max 20%

        config.fee_bps = new_fee_bps;
    }

    /// Admin: Pause/Unpause marketplace
    public entry fun set_pause(
        admin: &signer,
        paused: bool,
    ) acquires PlatformConfig {
        let admin_addr = signer::address_of(admin);
        let config = borrow_global_mut<PlatformConfig>(@verixa);

        assert!(admin_addr == config.platform_wallet, E_UNAUTHORIZED);
        config.is_paused = paused;
    }

    // View functions

    #[view]
    public fun get_content(content_id: u64): Content acquires ContentRegistry {
        let registry = borrow_global<ContentRegistry>(@verixa);
        assert!(table::contains(&registry.contents, content_id), E_CONTENT_NOT_FOUND);
        *table::borrow(&registry.contents, content_id)
    }

    #[view]
    public fun get_creator_contents(creator: address): vector<u64> acquires ContentRegistry {
        let registry = borrow_global<ContentRegistry>(@verixa);
        if (table::contains(&registry.creator_contents, creator)) {
            *table::borrow(&registry.creator_contents, creator)
        } else {
            vector::empty()
        }
    }

    #[view]
    public fun has_valid_access(user: address, content_id: u64, tier: u8): bool acquires PurchaseRegistry, ContentRegistry {
        let registry = borrow_global<PurchaseRegistry>(@verixa);
        let content_registry = borrow_global<ContentRegistry>(@verixa);

        if (!table::contains(&content_registry.contents, content_id)) {
            return false
        };

        let content = table::borrow(&content_registry.contents, content_id);
        if (!content.is_active) {
            return false
        };

        if (!table::contains(&registry.user_purchases, user)) {
            return false
        };

        let purchases = table::borrow(&registry.user_purchases, user);
        let current_time = timestamp::now_seconds();
        let i = 0;
        let len = vector::length(purchases);

        while (i < len) {
            let purchase_id = *vector::borrow(purchases, i);
            let purchase = table::borrow(&registry.purchases, purchase_id);

            if (purchase.content_id == content_id && purchase.is_active) {
                // Check if tier is sufficient (higher tiers include lower tier access)
                if (purchase.tier >= tier) {
                    // Check expiry (0 means permanent)
                    if (purchase.expiry_timestamp == 0 || purchase.expiry_timestamp > current_time) {
                        return true
                    };
                };
            };
            i = i + 1;
        };

        false
    }

    #[view]
    public fun get_purchase_details(purchase_id: u64): Purchase acquires PurchaseRegistry {
        let registry = borrow_global<PurchaseRegistry>(@verixa);
        assert!(table::contains(&registry.purchases, purchase_id), E_CONTENT_NOT_FOUND);
        *table::borrow(&registry.purchases, purchase_id)
    }

    #[view]
    public fun get_user_purchases(user: address): vector<u64> acquires PurchaseRegistry {
        let registry = borrow_global<PurchaseRegistry>(@verixa);
        if (table::contains(&registry.user_purchases, user)) {
            *table::borrow(&registry.user_purchases, user)
        } else {
            vector::empty()
        }
    }

    #[view]
    public fun get_platform_stats(): (u64, u64, u64) acquires PlatformConfig {
        let config = borrow_global<PlatformConfig>(@verixa);
        (config.total_volume, config.total_transactions, config.fee_bps)
    }

    #[view]
    public fun get_content_purchase_count(content_id: u64): u64 acquires PurchaseRegistry {
        let registry = borrow_global<PurchaseRegistry>(@verixa);
        if (table::contains(&registry.content_purchases, content_id)) {
            vector::length(table::borrow(&registry.content_purchases, content_id))
        } else {
            0
        }
    }

    #[view]
    public fun get_creator_stats(creator: address): (u64, u64, u64, u64) acquires StatsRegistry {
        let registry = borrow_global<StatsRegistry>(@verixa);
        if (table::contains(&registry.creators, creator)) {
            let stats = table::borrow(&registry.creators, creator);
            (stats.total_contents, stats.total_sales, stats.total_earnings, stats.subscriber_count)
        } else {
            (0, 0, 0, 0)
        }
    }

    // Helper functions

    fun get_tier_details(content: &Content, tier: u8): (u64, u64) {
        let price = if (tier == TIER_VIEW) {
            content.view_price
        } else if (tier == TIER_BORROW) {
            content.borrow_price
        } else if (tier == TIER_LICENSE) {
            content.license_price
        } else if (tier == TIER_COMMERCIAL) {
            content.commercial_price
        } else if (tier == TIER_SUBSCRIPTION) {
            content.subscription_price
        } else {
            0
        };

        let expiry = if (tier == TIER_VIEW) {
            timestamp::now_seconds() + VIEW_DURATION
        } else if (tier == TIER_BORROW) {
            timestamp::now_seconds() + BORROW_DURATION
        } else {
            0 // Permanent
        };

        (price, expiry)
    }

    fun generate_license_hash(buyer: address, content_id: u64, tier: u8, purchase_id: u64): vector<u8> {
        let data = vector::empty<u8>();
        vector::append(&mut data, bcs::to_bytes(&buyer));
        vector::append(&mut data, bcs::to_bytes(&content_id));
        vector::append(&mut data, bcs::to_bytes(&tier));
        vector::append(&mut data, bcs::to_bytes(&purchase_id));
        vector::append(&mut data, bcs::to_bytes(&timestamp::now_seconds()));
        hash::sha3_256(data)
    }

    fun update_creator_stats(creator: address, new_contents: u64, new_sales: u64, new_earnings: u64) acquires StatsRegistry {
        let registry = borrow_global_mut<StatsRegistry>(@verixa);

        if (!table::contains(&registry.creators, creator)) {
            table::add(&mut registry.creators, creator, CreatorStats {
                creator,
                total_contents: 0,
                total_sales: 0,
                total_earnings: 0,
                subscriber_count: 0,
            });
        };

        let stats = table::borrow_mut(&mut registry.creators, creator);
        stats.total_contents = stats.total_contents + new_contents;
        stats.total_sales = stats.total_sales + new_sales;
        stats.total_earnings = stats.total_earnings + new_earnings;
    }

    #[test_only]
    public fun init_for_test(creator: &signer) {
        init_module(creator);
    }
}
