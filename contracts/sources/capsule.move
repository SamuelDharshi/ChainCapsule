/// ChainCapsule — On-chain Time Capsule & Dead Man's Switch
/// Hackathon: Tatum x Build on Sui with Walrus
///
/// Two unlock modes:
///   A) Fixed date:        unlock_after_ms > 0, inactivity_days = 0
///   B) Dead man's switch: unlock_after_ms = 0, inactivity_days > 0
module chaincapsule::capsule {
    use std::string::String;
    use sui::clock::{Self, Clock};
    use sui::event;

    // ─── Error codes ────────────────────────────────────────────────────────
    const E_NOT_UNLOCKABLE:  u64 = 1;
    const E_NOT_OWNER:       u64 = 2;
    const E_NOT_BENEFICIARY: u64 = 3;

    // ─── Constants ──────────────────────────────────────────────────────────
    const MS_IN_DAY: u64 = 86_400_000;

    // ─── Core struct (Move 2024: public visibility required) ────────────────
    /// Shared object representing a single time capsule
    public struct Capsule has key, store {
        id:              UID,
        owner:           address,
        beneficiary:     address,
        walrus_blob_id:  String,      // Walrus blob ID of the encrypted ciphertext
        enc_key_hint:    vector<u8>,  // Encrypted AES key — released on unlock
        unlock_after_ms: u64,         // Absolute epoch-ms; 0 = inactivity mode
        inactivity_days: u64,         // Days of silence before unlock; 0 = date mode
        last_heartbeat:  u64,         // Timestamp of last owner heartbeat (ms)
        created_at:      u64,         // Creation timestamp (ms)
    }

    // ─── Events (Move 2024: public visibility required) ──────────────────────
    public struct CapsuleCreated has copy, drop {
        capsule_id:      address,
        owner:           address,
        beneficiary:     address,
        walrus_blob_id:  String,
        unlock_after_ms: u64,
        inactivity_days: u64,
    }

    public struct HeartbeatSent has copy, drop {
        capsule_id:   address,
        owner:        address,
        timestamp_ms: u64,
    }

    public struct CapsuleUnlocked has copy, drop {
        capsule_id:   address,
        beneficiary:  address,
        timestamp_ms: u64,
    }

    // ─── Public entry functions ──────────────────────────────────────────────

    /// Create a new capsule and share it on-chain.
    /// Caller becomes the owner; `beneficiary` is who can unlock it.
    public fun create(
        blob_id:        String,
        enc_key:        vector<u8>,
        beneficiary:    address,
        unlock_date_ms: u64,   // pass 0 for inactivity mode
        inactivity_d:   u64,   // pass 0 for fixed-date mode
        clock:          &Clock,
        ctx:            &mut TxContext
    ) {
        let now   = clock::timestamp_ms(clock);
        let owner = ctx.sender();

        let capsule = Capsule {
            id:              object::new(ctx),
            owner,
            beneficiary,
            walrus_blob_id:  blob_id,
            enc_key_hint:    enc_key,
            unlock_after_ms: unlock_date_ms,
            inactivity_days: inactivity_d,
            last_heartbeat:  now,
            created_at:      now,
        };

        event::emit(CapsuleCreated {
            capsule_id:      object::uid_to_address(&capsule.id),
            owner,
            beneficiary,
            walrus_blob_id:  capsule.walrus_blob_id,
            unlock_after_ms: unlock_date_ms,
            inactivity_days: inactivity_d,
        });

        transfer::share_object(capsule);
    }

    /// Owner pings this to reset the inactivity clock (dead man's switch).
    /// Reverts if sender is not the capsule owner.
    public fun heartbeat(
        cap:   &mut Capsule,
        clock: &Clock,
        ctx:   &TxContext
    ) {
        assert!(ctx.sender() == cap.owner, E_NOT_OWNER);

        let now = clock::timestamp_ms(clock);
        cap.last_heartbeat = now;

        event::emit(HeartbeatSent {
            capsule_id:   object::uid_to_address(&cap.id),
            owner:        ctx.sender(),
            timestamp_ms: now,
        });
    }

    /// Beneficiary calls this when the unlock condition is met.
    public fun unlock(
        cap:   &mut Capsule,
        clock: &Clock,
        ctx:   &TxContext
    ) {
        let now    = clock::timestamp_ms(clock);
        let sender = ctx.sender();

        // Evaluate unlock condition
        let by_date = cap.unlock_after_ms > 0 && now >= cap.unlock_after_ms;
        let by_inactivity =
            cap.inactivity_days > 0 &&
            (now - cap.last_heartbeat) >= cap.inactivity_days * MS_IN_DAY;

        assert!(by_date || by_inactivity, E_NOT_UNLOCKABLE);
        assert!(sender == cap.beneficiary, E_NOT_BENEFICIARY);

        event::emit(CapsuleUnlocked {
            capsule_id:   object::uid_to_address(&cap.id),
            beneficiary:  sender,
            timestamp_ms: now,
        });
    }

    // ─── View helpers ────────────────────────────────────────────────────────

    public fun is_unlockable(cap: &Capsule, clock: &Clock): bool {
        let now = clock::timestamp_ms(clock);
        let by_date       = cap.unlock_after_ms > 0 && now >= cap.unlock_after_ms;
        let by_inactivity =
            cap.inactivity_days > 0 &&
            (now - cap.last_heartbeat) >= cap.inactivity_days * MS_IN_DAY;
        by_date || by_inactivity
    }

    public fun owner(cap: &Capsule): address            { cap.owner }
    public fun beneficiary(cap: &Capsule): address      { cap.beneficiary }
    public fun walrus_blob_id(cap: &Capsule): &String   { &cap.walrus_blob_id }
    public fun enc_key_hint(cap: &Capsule): &vector<u8> { &cap.enc_key_hint }
    public fun unlock_after_ms(cap: &Capsule): u64      { cap.unlock_after_ms }
    public fun inactivity_days(cap: &Capsule): u64      { cap.inactivity_days }
    public fun last_heartbeat(cap: &Capsule): u64       { cap.last_heartbeat }
    public fun created_at(cap: &Capsule): u64           { cap.created_at }
}
