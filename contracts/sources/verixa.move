module verixa::verixa {
    use std::string::{String};
    use std::vector;
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::table::{Self, Table};
    use sui::hash;
    use sui::bcs;

    // Error codes
    const ENotCreator: u64 = 1;
    const EInvalidPrice: u64 = 2;
    const EContentNotFound: u64 = 3;
    const EAlreadyPurchased: u64 = 4;
    const EInsufficientBalance: u64 = 5;
    const EInvalidAccessTier: u64 = 6;
    const EUnauthorized: u64 = 7;
    const ESubscriptionExpired: u64 = 8;

    // Access tiers
    const TIER_FREE: u8 = 0;
    const TIER_STREAM: u8 = 1;
    const TIER_CITE: u8 = 2;
    const TIER_LICENSE: u8 = 3;
    const TIER_COMMERCIAL: u8 = 4;
    const TIER_SUBSCRIPTION: u8 = 5;

    // Platform fee: 10% (1000 basis points)
    const PLATFORM_FEE_BPS: u64 = 1000;
    const BASIS_POINTS: u64 = 10000;

    // Time constants (in milliseconds for Sui Clock)
    const STREAM_DURATION_MS: u64 = 86400 * 1000;       // 24 hours
    const CITE_DURATION_MS: u64 = 604800 * 1000;        // 7 days

    // Core structs
    public struct Content has store {
        content_id: u64,
        creator: address,
        title: String,
        description: String,
        content_type: String,
        walrus_blob_id: String,
        walrus_root_hash: vector<u8>,
        upload_timestamp: u64,
        is_active: bool,
        // Pricing (in MIST - smallest SUI unit)
        stream_price: u64,
        cite_price: u64,
        license_price: u64,
        commercial_price: u64,
        subscription_price: u64,
        // Metadata
        preview_blob_id: String,
        tags: vector<String>,
        collection_id: u64,
    }

    public struct Purchase has store {
        purchase_id: u64,
        buyer: address,
        content_id: u64,
        tier: u8,
        purchase_timestamp: u64,
        expiry_timestamp: u64, // 0 means permanent
        license_hash: vector<u8>,
        amount_paid: u64,
        is_active: bool,
    }

    public struct CreatorStats has store {
        creator: address,
        total_contents: u64,
        total_sales: u64,
        total_earnings: u64,
        subscriber_count: u64,
    }

    public struct MarketplaceState has key {
        id: UID,
        // Content Registry
        contents: Table<u64, Content>,
        next_content_id: u64,
        creator_contents: Table<address, vector<u64>>,
        content_count: u64,
        // Purchase Registry
        purchases: Table<u64, Purchase>,
        user_purchases: Table<address, vector<u64>>,
        content_purchases: Table<u64, vector<u64>>,
        next_purchase_id: u64,
        // Config
        platform_wallet: address,
        fee_bps: u64,
        total_volume: u64,
        total_transactions: u64,
        is_paused: bool,
        // Stats
        creator_stats: Table<address, CreatorStats>,
    }

    public struct AdminCap has key, store {
        id: UID
    }

    // Events
    public struct ContentPublished has copy, drop {
        content_id: u64,
        creator: address,
        title: String,
        content_type: String,
        timestamp: u64,
    }

    public struct ContentPurchased has copy, drop {
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

    public struct ContentUpdated has copy, drop {
        content_id: u64,
        creator: address,
        timestamp: u64,
    }

    public struct ContentDeactivated has copy, drop {
        content_id: u64,
        creator: address,
        timestamp: u64,
    }

    fun init(ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);

        transfer::transfer(AdminCap {
            id: object::new(ctx)
        }, sender);

        transfer::share_object(MarketplaceState {
            id: object::new(ctx),
            contents: table::new(ctx),
            next_content_id: 1,
            creator_contents: table::new(ctx),
            content_count: 0,
            purchases: table::new(ctx),
            user_purchases: table::new(ctx),
            content_purchases: table::new(ctx),
            next_purchase_id: 1,
            platform_wallet: sender,
            fee_bps: PLATFORM_FEE_BPS,
            total_volume: 0,
            total_transactions: 0,
            is_paused: false,
            creator_stats: table::new(ctx),
        });
    }

    // Public entry functions

    /// Publish new content to the marketplace
    public entry fun publish_content(
        state: &mut MarketplaceState,
        clock: &Clock,
        title: String,
        description: String,
        content_type: String,
        walrus_blob_id: String,
        walrus_root_hash: vector<u8>,
        preview_blob_id: String,
        stream_price: u64,
        cite_price: u64,
        license_price: u64,
        commercial_price: u64,
        subscription_price: u64,
        tags: vector<String>,
        collection_id: u64,
        ctx: &mut TxContext
    ) {
        let creator_addr = tx_context::sender(ctx);
        let content_id = state.next_content_id;
        let current_time = clock::timestamp_ms(clock);

        let content = Content {
            content_id,
            creator: creator_addr,
            title,
            description,
            content_type,
            walrus_blob_id,
            walrus_root_hash,
            upload_timestamp: current_time,
            is_active: true,
            stream_price,
            cite_price,
            license_price,
            commercial_price,
            subscription_price,
            preview_blob_id,
            tags,
            collection_id,
        };

        table::add(&mut state.contents, content_id, content);
        state.next_content_id = content_id + 1;
        state.content_count = state.content_count + 1;

        // Add to creator's content list
        if (!table::contains(&state.creator_contents, creator_addr)) {
            table::add(&mut state.creator_contents, creator_addr, vector::empty());
        };
        let creator_list = table::borrow_mut(&mut state.creator_contents, creator_addr);
        vector::push_back(creator_list, content_id);

        // Update creator stats
        update_creator_stats(state, creator_addr, 1, 0, 0);

        event::emit(ContentPublished {
            content_id,
            creator: creator_addr,
            title,
            content_type,
            timestamp: current_time,
        });
    }

    /// Purchase access to content
    public entry fun purchase_access(
        state: &mut MarketplaceState,
        clock: &Clock,
        content_id: u64,
        tier: u8,
        payment: &mut Coin<SUI>,
        ctx: &mut TxContext
    ) {
        let buyer_addr = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);

        assert!(!state.is_paused, EUnauthorized);
        assert!(table::contains(&state.contents, content_id), EContentNotFound);

        let content = table::borrow(&state.contents, content_id);
        assert!(content.is_active, EContentNotFound);

        // Determine price and expiry based on tier
        let (price, expiry) = get_tier_details(content, tier, current_time);
        assert!(price > 0, EInvalidAccessTier);
        assert!(coin::value(payment) >= price, EInsufficientBalance);

        // Calculate fees
        let platform_fee = (price * state.fee_bps) / BASIS_POINTS;
        let creator_amount = price - platform_fee;

        let content_creator = content.creator; // copy address before mutable borrow

        // Process payments
        let platform_payment = coin::split(payment, platform_fee, ctx);
        let creator_payment = coin::split(payment, creator_amount, ctx);

        transfer::public_transfer(platform_payment, state.platform_wallet);
        transfer::public_transfer(creator_payment, content_creator);

        // Record purchase
        let purchase_id = state.next_purchase_id;
        let license_hash = generate_license_hash(buyer_addr, content_id, tier, purchase_id, current_time);

        let purchase = Purchase {
            purchase_id,
            buyer: buyer_addr,
            content_id,
            tier,
            purchase_timestamp: current_time,
            expiry_timestamp: expiry,
            license_hash,
            amount_paid: price,
            is_active: true,
        };

        table::add(&mut state.purchases, purchase_id, purchase);
        state.next_purchase_id = purchase_id + 1;

        // Add to user's purchases
        if (!table::contains(&state.user_purchases, buyer_addr)) {
            table::add(&mut state.user_purchases, buyer_addr, vector::empty());
        };
        let user_list = table::borrow_mut(&mut state.user_purchases, buyer_addr);
        vector::push_back(user_list, purchase_id);

        // Add to content's purchases
        if (!table::contains(&state.content_purchases, content_id)) {
            table::add(&mut state.content_purchases, content_id, vector::empty());
        };
        let content_list = table::borrow_mut(&mut state.content_purchases, content_id);
        vector::push_back(content_list, purchase_id);

        // Update platform stats
        state.total_volume = state.total_volume + price;
        state.total_transactions = state.total_transactions + 1;

        // Update creator stats
        update_creator_stats(state, content_creator, 0, 1, creator_amount);

        event::emit(ContentPurchased {
            purchase_id,
            content_id,
            buyer: buyer_addr,
            creator: content_creator,
            tier,
            amount: price,
            platform_fee,
            creator_amount,
            timestamp: current_time,
        });
    }

    /// Update content pricing or metadata
    public entry fun update_content(
        state: &mut MarketplaceState,
        clock: &Clock,
        content_id: u64,
        title: String,
        description: String,
        stream_price: u64,
        cite_price: u64,
        license_price: u64,
        commercial_price: u64,
        subscription_price: u64,
        is_active: bool,
        ctx: &mut TxContext
    ) {
        let creator_addr = tx_context::sender(ctx);

        assert!(table::contains(&state.contents, content_id), EContentNotFound);
        let content = table::borrow_mut(&mut state.contents, content_id);
        assert!(content.creator == creator_addr, ENotCreator);

        content.title = title;
        content.description = description;
        content.stream_price = stream_price;
        content.cite_price = cite_price;
        content.license_price = license_price;
        content.commercial_price = commercial_price;
        content.subscription_price = subscription_price;
        content.is_active = is_active;

        event::emit(ContentUpdated {
            content_id,
            creator: creator_addr,
            timestamp: clock::timestamp_ms(clock),
        });
    }

    /// Deactivate content
    public entry fun deactivate_content(
        state: &mut MarketplaceState,
        clock: &Clock,
        content_id: u64,
        ctx: &mut TxContext
    ) {
        let creator_addr = tx_context::sender(ctx);

        assert!(table::contains(&state.contents, content_id), EContentNotFound);
        let content = table::borrow_mut(&mut state.contents, content_id);
        assert!(content.creator == creator_addr, ENotCreator);

        content.is_active = false;

        event::emit(ContentDeactivated {
            content_id,
            creator: creator_addr,
            timestamp: clock::timestamp_ms(clock),
        });
    }

    /// Admin: Update platform fee
    public entry fun update_platform_fee(
        _: &AdminCap,
        state: &mut MarketplaceState,
        new_fee_bps: u64,
    ) {
        assert!(new_fee_bps <= 2000, EInvalidPrice); // Max 20%
        state.fee_bps = new_fee_bps;
    }

    /// Admin: Pause/Unpause marketplace
    public entry fun set_pause(
        _: &AdminCap,
        state: &mut MarketplaceState,
        paused: bool,
    ) {
        state.is_paused = paused;
    }

    // Helper functions

    fun get_tier_details(content: &Content, tier: u8, current_time: u64): (u64, u64) {
        let price = if (tier == TIER_STREAM) {
            content.stream_price
        } else if (tier == TIER_CITE) {
            content.cite_price
        } else if (tier == TIER_LICENSE) {
            content.license_price
        } else if (tier == TIER_COMMERCIAL) {
            content.commercial_price
        } else if (tier == TIER_SUBSCRIPTION) {
            content.subscription_price
        } else {
            0
        };

        let expiry = if (tier == TIER_STREAM) {
            current_time + STREAM_DURATION_MS
        } else if (tier == TIER_CITE) {
            current_time + CITE_DURATION_MS
        } else {
            0 // Permanent
        };

        (price, expiry)
    }

    fun generate_license_hash(buyer: address, content_id: u64, tier: u8, purchase_id: u64, current_time: u64): vector<u8> {
        let mut data = vector::empty<u8>();
        vector::append(&mut data, bcs::to_bytes(&buyer));
        vector::append(&mut data, bcs::to_bytes(&content_id));
        vector::append(&mut data, bcs::to_bytes(&tier));
        vector::append(&mut data, bcs::to_bytes(&purchase_id));
        vector::append(&mut data, bcs::to_bytes(&current_time));
        hash::blake2b256(&data)
    }

    fun update_creator_stats(state: &mut MarketplaceState, creator: address, new_contents: u64, new_sales: u64, new_earnings: u64) {
        if (!table::contains(&state.creator_stats, creator)) {
            table::add(&mut state.creator_stats, creator, CreatorStats {
                creator,
                total_contents: 0,
                total_sales: 0,
                total_earnings: 0,
                subscriber_count: 0,
            });
        };

        let stats = table::borrow_mut(&mut state.creator_stats, creator);
        stats.total_contents = stats.total_contents + new_contents;
        stats.total_sales = stats.total_sales + new_sales;
        stats.total_earnings = stats.total_earnings + new_earnings;
    }
}
