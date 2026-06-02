module verixa::verixa {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use sui::event;
    use std::string::String;

    // Error codes
    const E_NOT_AUTHORIZED: u64 = 1;

    // Events
    public struct ContentPublished has copy, drop {
        content_id: address,
        creator: address,
        title: String,
        content_type: String,
        timestamp: u64,
    }

    public struct SharedState has key {
        id: UID,
    }

    public struct Content has key, store {
        id: UID,
        creator: address,
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
        upload_timestamp: u64,
    }

    fun init(ctx: &mut TxContext) {
        transfer::share_object(SharedState {
            id: object::new(ctx)
        });
    }

    public entry fun publish_content(
        _state: &mut SharedState,
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
        let creator = tx_context::sender(ctx);
        
        let content_uid = object::new(ctx);
        let content_id = object::uid_to_address(&content_uid);

        let content = Content {
            id: content_uid,
            creator,
            title,
            description,
            content_type,
            walrus_blob_id,
            walrus_root_hash,
            preview_blob_id,
            stream_price,
            cite_price,
            license_price,
            commercial_price,
            subscription_price,
            tags,
            collection_id,
            upload_timestamp: clock::timestamp_ms(clock),
        };

        transfer::share_object(content);

        event::emit(ContentPublished {
            content_id,
            creator,
            title,
            content_type,
            timestamp: clock::timestamp_ms(clock),
        });
    }
}
