module verixa::subscription {
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
    const E_SUBSCRIPTION_NOT_FOUND: u64 = 1;
    const E_ALREADY_SUBSCRIBED: u64 = 2;
    const E_INSUFFICIENT_BALANCE: u64 = 3;
    const E_UNAUTHORIZED: u64 = 4;
    const E_INVALID_PRICE: u64 = 5;
    const E_SUBSCRIPTION_EXPIRED: u64 = 6;
    const E_NOT_SUBSCRIBED: u64 = 7;

    // Constants
    const PLATFORM_FEE_BPS: u64 = 1000; // 10%
    const BASIS_POINTS: u64 = 10000;
    const SECONDS_PER_MONTH: u64 = 2592000; // 30 days

    // Events
    #[event]
    struct SubscriptionTierCreated has drop, store {
        creator: address,
        monthly_price: u64,
        timestamp: u64,
    }

    #[event]
    struct SubscriptionStarted has drop, store {
        subscriber: address,
        creator: address,
        monthly_price: u64,
        timestamp: u64,
    }

    #[event]
    struct SubscriptionRenewed has drop, store {
        subscriber: address,
        creator: address,
        amount: u64,
        timestamp: u64,
    }

    #[event]
    struct SubscriptionCancelled has drop, store {
        subscriber: address,
        creator: address,
        timestamp: u64,
    }

    #[event]
    struct SubscriptionExpired has drop, store {
        subscriber: address,
        creator: address,
        timestamp: u64,
    }

    // Structs
    struct SubscriptionTier has key, store, drop, copy {
        creator: address,
        monthly_price: u64,
        benefits_description: String,
        is_active: bool,
        created_at: u64,
    }

    struct Subscription has key, store, drop, copy {
        subscriber: address,
        creator: address,
        monthly_price: u64,
        start_timestamp: u64,
        last_payment_timestamp: u64,
        next_payment_timestamp: u64,
        is_active: bool,
        total_payments: u64,
        total_amount_paid: u64,
    }

    struct CreatorSubscriptions has key {
        tier: SubscriptionTier,
        subscribers: Table<address, Subscription>,
        subscriber_count: u64,
        total_revenue: u64,
    }

    struct SubscriberRegistry has key {
        subscriptions: Table<address, Subscription>, // creator -> subscription
        total_subscriptions: u64,
    }

    struct PlatformConfig has key {
        platform_wallet: address,
        fee_bps: u64,
        total_subscription_volume: u64,
    }

    // Initialization
    fun init_module(creator: &signer) {
        let creator_addr = signer::address_of(creator);

        move_to(creator, PlatformConfig {
            platform_wallet: creator_addr,
            fee_bps: PLATFORM_FEE_BPS,
            total_subscription_volume: 0,
        });
    }

    // Public entry functions

    /// Creator: Set up subscription tier
    public entry fun create_subscription_tier(
        creator: &signer,
        monthly_price: u64,
        benefits_description: String,
    ) acquires PlatformConfig, CreatorSubscriptions {
        let creator_addr = signer::address_of(creator);
        let config = borrow_global<PlatformConfig>(@verixa);

        assert!(monthly_price > 0, E_INVALID_PRICE);

        let tier = SubscriptionTier {
            creator: creator_addr,
            monthly_price,
            benefits_description,
            is_active: true,
            created_at: timestamp::now_seconds(),
        };

        if (exists<CreatorSubscriptions>(creator_addr)) {
            let subs = borrow_global_mut<CreatorSubscriptions>(creator_addr);
            subs.tier = tier;
            subs.tier.is_active = true;
        } else {
            move_to(creator, CreatorSubscriptions {
                tier,
                subscribers: table::new(),
                subscriber_count: 0,
                total_revenue: 0,
            });
        };

        event::emit(SubscriptionTierCreated {
            creator: creator_addr,
            monthly_price,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Creator: Update subscription tier
    public entry fun update_subscription_tier(
        creator: &signer,
        new_monthly_price: u64,
        new_benefits: String,
    ) acquires CreatorSubscriptions {
        let creator_addr = signer::address_of(creator);
        assert!(exists<CreatorSubscriptions>(creator_addr), E_SUBSCRIPTION_NOT_FOUND);

        let subs = borrow_global_mut<CreatorSubscriptions>(creator_addr);
        subs.tier.monthly_price = new_monthly_price;
        subs.tier.benefits_description = new_benefits;
    }

    /// Creator: Deactivate subscription tier
    public entry fun deactivate_subscription_tier(
        creator: &signer,
    ) acquires CreatorSubscriptions {
        let creator_addr = signer::address_of(creator);
        assert!(exists<CreatorSubscriptions>(creator_addr), E_SUBSCRIPTION_NOT_FOUND);

        let subs = borrow_global_mut<CreatorSubscriptions>(creator_addr);
        subs.tier.is_active = false;
    }

    /// User: Subscribe to a creator
    public entry fun subscribe(
        subscriber: &signer,
        creator: address,
    ) acquires CreatorSubscriptions, SubscriberRegistry, PlatformConfig {
        let subscriber_addr = signer::address_of(subscriber);

        assert!(exists<CreatorSubscriptions>(creator), E_SUBSCRIPTION_NOT_FOUND);
        let creator_subs = borrow_global_mut<CreatorSubscriptions>(creator);

        assert!(creator_subs.tier.is_active, E_SUBSCRIPTION_NOT_FOUND);
        assert!(!table::contains(&creator_subs.subscribers, subscriber_addr), E_ALREADY_SUBSCRIBED);

        let monthly_price = creator_subs.tier.monthly_price;
        let config = borrow_global<PlatformConfig>(@verixa);
        let platform_fee = (monthly_price * config.fee_bps) / BASIS_POINTS;
        let creator_amount = monthly_price - platform_fee;

        // Process first payment
        coin::transfer<AptosCoin>(subscriber, config.platform_wallet, platform_fee);
        coin::transfer<AptosCoin>(subscriber, creator, creator_amount);

        let current_time = timestamp::now_seconds();
        let subscription = Subscription {
            subscriber: subscriber_addr,
            creator,
            monthly_price,
            start_timestamp: current_time,
            last_payment_timestamp: current_time,
            next_payment_timestamp: current_time + SECONDS_PER_MONTH,
            is_active: true,
            total_payments: 1,
            total_amount_paid: monthly_price,
        };

        table::add(&mut creator_subs.subscribers, subscriber_addr, subscription);
        creator_subs.subscriber_count = creator_subs.subscriber_count + 1;
        creator_subs.total_revenue = creator_subs.total_revenue + creator_amount;

        // Add to subscriber's registry
        if (!exists<SubscriberRegistry>(subscriber_addr)) {
            move_to(subscriber, SubscriberRegistry {
                subscriptions: table::new(),
                total_subscriptions: 0,
            });
        };

        let sub_registry = borrow_global_mut<SubscriberRegistry>(subscriber_addr);
        table::add(&mut sub_registry.subscriptions, creator, subscription);
        sub_registry.total_subscriptions = sub_registry.total_subscriptions + 1;

        // Update platform stats
        let config_mut = borrow_global_mut<PlatformConfig>(@verixa);
        config_mut.total_subscription_volume = config_mut.total_subscription_volume + monthly_price;

        event::emit(SubscriptionStarted {
            subscriber: subscriber_addr,
            creator,
            monthly_price,
            timestamp: current_time,
        });
    }

    /// User: Cancel subscription
    public entry fun cancel_subscription(
        subscriber: &signer,
        creator: address,
    ) acquires CreatorSubscriptions, SubscriberRegistry {
        let subscriber_addr = signer::address_of(subscriber);

        assert!(exists<CreatorSubscriptions>(creator), E_SUBSCRIPTION_NOT_FOUND);
        let creator_subs = borrow_global_mut<CreatorSubscriptions>(creator);

        assert!(table::contains(&creator_subs.subscribers, subscriber_addr), E_NOT_SUBSCRIBED);

        let sub = table::borrow_mut(&mut creator_subs.subscribers, subscriber_addr);
        sub.is_active = false;

        // Update subscriber registry
        let sub_registry = borrow_global_mut<SubscriberRegistry>(subscriber_addr);
        let sub_entry = table::borrow_mut(&mut sub_registry.subscriptions, creator);
        sub_entry.is_active = false;

        event::emit(SubscriptionCancelled {
            subscriber: subscriber_addr,
            creator,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Cron: Process recurring payments
    public entry fun process_recurring_payments(
        processor: &signer,
        creators: vector<address>,
    ) acquires CreatorSubscriptions, PlatformConfig {
        let config = borrow_global<PlatformConfig>(@verixa);
        let current_time = timestamp::now_seconds();
        let i = 0;

        while (i < vector::length(&creators)) {
            let creator = *vector::borrow(&creators, i);

            if (exists<CreatorSubscriptions>(creator)) {
                let creator_subs = borrow_global_mut<CreatorSubscriptions>(creator);

                // Iterate through subscribers (simplified - in production use more efficient iteration)
                // This is a placeholder for the actual implementation
            };

            i = i + 1;
        };
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

    // View functions

    #[view]
    public fun get_subscription_tier(creator: address): SubscriptionTier acquires CreatorSubscriptions {
        let creator_subs = borrow_global<CreatorSubscriptions>(creator);
        creator_subs.tier
    }

    #[view]
    public fun has_active_subscription(subscriber: address, creator: address): bool acquires CreatorSubscriptions {
        if (!exists<CreatorSubscriptions>(creator)) {
            return false
        };

        let creator_subs = borrow_global<CreatorSubscriptions>(creator);

        if (!table::contains(&creator_subs.subscribers, subscriber)) {
            return false
        };

        let sub = table::borrow(&creator_subs.subscribers, subscriber);
        let current_time = timestamp::now_seconds();

        sub.is_active && sub.next_payment_timestamp > current_time
    }

    #[view]
    public fun get_subscription_details(subscriber: address, creator: address): Subscription acquires CreatorSubscriptions {
        let creator_subs = borrow_global<CreatorSubscriptions>(creator);
        assert!(table::contains(&creator_subs.subscribers, subscriber), E_NOT_SUBSCRIBED);
        *table::borrow(&creator_subs.subscribers, subscriber)
    }

    #[view]
    public fun get_creator_subscriber_stats(creator: address): (u64, u64) acquires CreatorSubscriptions {
        if (!exists<CreatorSubscriptions>(creator)) {
            return (0, 0)
        };

        let creator_subs = borrow_global<CreatorSubscriptions>(creator);
        (creator_subs.subscriber_count, creator_subs.total_revenue)
    }

    #[view]
    public fun get_user_subscriptions(user: address): vector<Subscription> acquires SubscriberRegistry {
        if (!exists<SubscriberRegistry>(user)) {
            return vector::empty()
        };

        let registry = borrow_global<SubscriberRegistry>(user);
        let subs = vector::empty<Subscription>();

        // Note: In production, implement proper iteration
        // This is a simplified version

        subs
    }

    #[view]
    public fun get_platform_subscription_stats(): (u64, u64) acquires PlatformConfig {
        let config = borrow_global<PlatformConfig>(@verixa);
        (config.total_subscription_volume, config.fee_bps)
    }

    #[test_only]
    public fun init_for_test(creator: &signer) {
        init_module(creator);
    }
}
