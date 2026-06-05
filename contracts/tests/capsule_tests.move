/// ============================================================================
/// ChainCapsule — Comprehensive Test Suite
/// ============================================================================
/// Tests are organized by function. Each function has at minimum 3 test cases:
///   - Happy-path success
///   - Expected failure cases
///   - Edge-case / boundary conditions
/// ============================================================================
#[test_only]
module chaincapsule::capsule_tests {
    use sui::test_scenario;
    use sui::clock;
    use std::string;
    use chaincapsule::capsule;
    use chaincapsule::capsule::Capsule;

    // ── Test Addresses ────────────────────────────────────────────────────────
    const OWNER:       address = @0xAAAA;
    const BENEFICIARY: address = @0xBBBB;
    const STRANGER:    address = @0xCCCC;
    const STRANGER2:   address = @0xDDDD;

    // ── Time Constants ────────────────────────────────────────────────────────
    const T0: u64 = 1_000_000;        // Creation time (ms)
    const ONE_DAY_MS: u64 = 86_400_000;

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// Create and share a capsule as OWNER at time T0
    fun setup_time_capsule(scenario: &mut test_scenario::Scenario, unlock_ms: u64): clock::Clock {
        test_scenario::next_tx(scenario, OWNER);
        let mut clk = clock::create_for_testing(test_scenario::ctx(scenario));
        clock::set_for_testing(&mut clk, T0);
        capsule::create(
            string::utf8(b"walrus-blob-abc123"),
            b"encrypted-aes-key-32-bytes-here!",
            BENEFICIARY,
            unlock_ms,
            0,
            &clk,
            test_scenario::ctx(scenario),
        );
        clk
    }

    /// Create and share a dead man's switch capsule as OWNER at time T0
    fun setup_dms_capsule(scenario: &mut test_scenario::Scenario, inactivity_days: u64): clock::Clock {
        test_scenario::next_tx(scenario, OWNER);
        let mut clk = clock::create_for_testing(test_scenario::ctx(scenario));
        clock::set_for_testing(&mut clk, T0);
        capsule::create(
            string::utf8(b"walrus-blob-dms456"),
            b"another-enc-key-for-dms-capsule!",
            BENEFICIARY,
            0,
            inactivity_days,
            &clk,
            test_scenario::ctx(scenario),
        );
        clk
    }

    // ============================================================================
    // MODULE: capsule::create — 4 tests
    // ============================================================================

    /// TEST 1: Capsule is created with correct field values in time-capsule mode
    #[test]
    fun test_create_stores_correct_fields_time_mode() {
        let mut scenario = test_scenario::begin(OWNER);
        let clock = setup_time_capsule(&mut scenario, 9_999_999);

        test_scenario::next_tx(&mut scenario, OWNER);
        let cap = test_scenario::take_shared<Capsule>(&scenario);

        assert!(capsule::owner(&cap)          == OWNER,       0);
        assert!(capsule::beneficiary(&cap)    == BENEFICIARY,  1);
        assert!(capsule::unlock_after_ms(&cap) == 9_999_999,  2);
        assert!(capsule::inactivity_days(&cap) == 0,           3);
        assert!(capsule::last_heartbeat(&cap) == T0,           4);
        assert!(capsule::created_at(&cap)     == T0,           5);

        clock::destroy_for_testing(clock);
        test_scenario::return_shared(cap);
        test_scenario::end(scenario);
    }

    /// TEST 2: Capsule is created with correct field values in dead-man's-switch mode
    #[test]
    fun test_create_stores_correct_fields_dms_mode() {
        let mut scenario = test_scenario::begin(OWNER);
        let clock = setup_dms_capsule(&mut scenario, 90);

        test_scenario::next_tx(&mut scenario, OWNER);
        let cap = test_scenario::take_shared<Capsule>(&scenario);

        assert!(capsule::owner(&cap)           == OWNER,      0);
        assert!(capsule::beneficiary(&cap)     == BENEFICIARY, 1);
        assert!(capsule::unlock_after_ms(&cap) == 0,           2); // not date mode
        assert!(capsule::inactivity_days(&cap) == 90,          3);
        assert!(capsule::last_heartbeat(&cap)  == T0,          4);

        clock::destroy_for_testing(clock);
        test_scenario::return_shared(cap);
        test_scenario::end(scenario);
    }

    /// TEST 3: A second capsule can be created by the same owner (no singleton constraint)
    #[test]
    fun test_create_multiple_capsules_same_owner() {
        let mut scenario = test_scenario::begin(OWNER);

        // First capsule
        test_scenario::next_tx(&mut scenario, OWNER);
        {
            let clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));
            capsule::create(
                string::utf8(b"blob-1"),
                b"key-1",
                BENEFICIARY,
                2_000_000,
                0,
                &clock,
                test_scenario::ctx(&mut scenario),
            );
            clock::destroy_for_testing(clock);
        };

        // Second capsule — different blob, different beneficiary
        test_scenario::next_tx(&mut scenario, OWNER);
        {
            let clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));
            capsule::create(
                string::utf8(b"blob-2"),
                b"key-2",
                STRANGER,
                3_000_000,
                0,
                &clock,
                test_scenario::ctx(&mut scenario),
            );
            clock::destroy_for_testing(clock);
        };

        // Both capsules should be in the shared object pool
        // (We just verify no abort happened — the test passing IS the assertion)
        test_scenario::end(scenario);
    }

    /// TEST 4: Any address (not just owner) can create a capsule
    #[test]
    fun test_create_by_different_senders() {
        let mut scenario = test_scenario::begin(STRANGER);
        let clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));
        capsule::create(
            string::utf8(b"blob-stranger"),
            b"stranger-key",
            BENEFICIARY,
            5_000_000,
            0,
            &clock,
            test_scenario::ctx(&mut scenario),
        );
        clock::destroy_for_testing(clock);

        test_scenario::next_tx(&mut scenario, STRANGER);
        let cap = test_scenario::take_shared<Capsule>(&scenario);
        assert!(capsule::owner(&cap) == STRANGER, 0); // stranger is the owner
        test_scenario::return_shared(cap);
        test_scenario::end(scenario);
    }

    // ============================================================================
    // MODULE: capsule::heartbeat — 4 tests
    // ============================================================================

    /// TEST 1: Owner heartbeat updates last_heartbeat timestamp
    #[test]
    fun test_heartbeat_updates_timestamp() {
        let mut scenario = test_scenario::begin(OWNER);
        let mut clock = setup_dms_capsule(&mut scenario, 90);

        test_scenario::next_tx(&mut scenario, OWNER);
        {
            let mut cap = test_scenario::take_shared<Capsule>(&scenario);
            clock::set_for_testing(&mut clock, T0 + ONE_DAY_MS); // advance 1 day

            capsule::heartbeat(&mut cap, &clock, test_scenario::ctx(&mut scenario));
            assert!(capsule::last_heartbeat(&cap) == T0 + ONE_DAY_MS, 0);

            test_scenario::return_shared(cap);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    /// TEST 2: Multiple heartbeats accumulate — each resets the timer
    #[test]
    fun test_heartbeat_multiple_times_keeps_resetting() {
        let mut scenario = test_scenario::begin(OWNER);
        let mut clock = setup_dms_capsule(&mut scenario, 1);

        // First heartbeat at day 1
        test_scenario::next_tx(&mut scenario, OWNER);
        {
            let mut cap = test_scenario::take_shared<Capsule>(&scenario);
            clock::set_for_testing(&mut clock, T0 + ONE_DAY_MS);
            capsule::heartbeat(&mut cap, &clock, test_scenario::ctx(&mut scenario));
            assert!(capsule::last_heartbeat(&cap) == T0 + ONE_DAY_MS, 0);
            test_scenario::return_shared(cap);
        };

        // Second heartbeat at day 2
        test_scenario::next_tx(&mut scenario, OWNER);
        {
            let mut cap = test_scenario::take_shared<Capsule>(&scenario);
            clock::set_for_testing(&mut clock, T0 + 2 * ONE_DAY_MS);
            capsule::heartbeat(&mut cap, &clock, test_scenario::ctx(&mut scenario));
            assert!(capsule::last_heartbeat(&cap) == T0 + 2 * ONE_DAY_MS, 1);
            test_scenario::return_shared(cap);
        };

        // Third heartbeat at day 5 (skipped some days but owner is alive)
        test_scenario::next_tx(&mut scenario, OWNER);
        {
            let mut cap = test_scenario::take_shared<Capsule>(&scenario);
            clock::set_for_testing(&mut clock, T0 + 5 * ONE_DAY_MS);
            capsule::heartbeat(&mut cap, &clock, test_scenario::ctx(&mut scenario));
            assert!(capsule::last_heartbeat(&cap) == T0 + 5 * ONE_DAY_MS, 2);
            test_scenario::return_shared(cap);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    /// TEST 3: Non-owner (stranger) cannot send a heartbeat — must abort
    #[test]
    #[expected_failure(abort_code = chaincapsule::capsule::E_NOT_OWNER)]
    fun test_heartbeat_rejects_stranger() {
        let mut scenario = test_scenario::begin(OWNER);
        let mut clock = setup_dms_capsule(&mut scenario, 90);

        test_scenario::next_tx(&mut scenario, STRANGER);
        let mut cap = test_scenario::take_shared<Capsule>(&scenario);
        clock::set_for_testing(&mut clock, T0 + ONE_DAY_MS);

        capsule::heartbeat(&mut cap, &clock, test_scenario::ctx(&mut scenario));

        clock::destroy_for_testing(clock);
        test_scenario::return_shared(cap);
        test_scenario::end(scenario);
    }

    /// TEST 4: Beneficiary cannot send a heartbeat (only owner can)
    #[test]
    #[expected_failure(abort_code = chaincapsule::capsule::E_NOT_OWNER)]
    fun test_heartbeat_rejects_beneficiary() {
        let mut scenario = test_scenario::begin(OWNER);
        let mut clock = setup_dms_capsule(&mut scenario, 90);

        test_scenario::next_tx(&mut scenario, BENEFICIARY); // beneficiary tries heartbeat
        let mut cap = test_scenario::take_shared<Capsule>(&scenario);
        clock::set_for_testing(&mut clock, T0 + ONE_DAY_MS);

        capsule::heartbeat(&mut cap, &clock, test_scenario::ctx(&mut scenario));

        clock::destroy_for_testing(clock);
        test_scenario::return_shared(cap);
        test_scenario::end(scenario);
    }

    // ============================================================================
    // MODULE: capsule::unlock — 6 tests
    // ============================================================================

    /// TEST 1: Fixed-date unlock succeeds exactly at the unlock timestamp
    #[test]
    fun test_unlock_fixed_date_exact_time() {
        let unlock_at = T0 + 5_000_000;
        let mut scenario = test_scenario::begin(OWNER);
        let mut clock = setup_time_capsule(&mut scenario, unlock_at);

        test_scenario::next_tx(&mut scenario, BENEFICIARY);
        {
            let mut cap = test_scenario::take_shared<Capsule>(&scenario);
            clock::set_for_testing(&mut clock, unlock_at); // exactly at unlock time
            capsule::unlock(&mut cap, &clock, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(cap);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    /// TEST 2: Fixed-date unlock succeeds well after the unlock timestamp
    #[test]
    fun test_unlock_fixed_date_way_after() {
        let unlock_at = T0 + 1_000;
        let mut scenario = test_scenario::begin(OWNER);
        let mut clock = setup_time_capsule(&mut scenario, unlock_at);

        test_scenario::next_tx(&mut scenario, BENEFICIARY);
        {
            let mut cap = test_scenario::take_shared<Capsule>(&scenario);
            // Many milliseconds after unlock_at
            clock::set_for_testing(&mut clock, unlock_at + 999_999_999);
            capsule::unlock(&mut cap, &clock, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(cap);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    /// TEST 3: Fixed-date unlock fails 1ms before the unlock timestamp (boundary test)
    #[test]
    #[expected_failure(abort_code = chaincapsule::capsule::E_NOT_UNLOCKABLE)]
    fun test_unlock_fixed_date_one_ms_early() {
        let unlock_at = T0 + 5_000_000;
        let mut scenario = test_scenario::begin(OWNER);
        let mut clock = setup_time_capsule(&mut scenario, unlock_at);

        test_scenario::next_tx(&mut scenario, BENEFICIARY);
        {
            let mut cap = test_scenario::take_shared<Capsule>(&scenario);
            clock::set_for_testing(&mut clock, unlock_at - 1); // 1ms too early
            capsule::unlock(&mut cap, &clock, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(cap);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    /// TEST 4: DMS unlock succeeds after the inactivity period expires
    #[test]
    fun test_unlock_dms_after_inactivity_expires() {
        let mut scenario = test_scenario::begin(OWNER);
        let mut clock = setup_dms_capsule(&mut scenario, 3); // 3-day inactivity

        test_scenario::next_tx(&mut scenario, BENEFICIARY);
        {
            let mut cap = test_scenario::take_shared<Capsule>(&scenario);
            // 3 days + 1ms after last_heartbeat (T0)
            clock::set_for_testing(&mut clock, T0 + 3 * ONE_DAY_MS + 1);
            capsule::unlock(&mut cap, &clock, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(cap);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    /// TEST 5: DMS unlock fails when heartbeat is recent (inactivity not yet met)
    #[test]
    #[expected_failure(abort_code = chaincapsule::capsule::E_NOT_UNLOCKABLE)]
    fun test_unlock_dms_fails_when_heartbeat_is_recent() {
        let mut scenario = test_scenario::begin(OWNER);
        let mut clock = setup_dms_capsule(&mut scenario, 7); // 7-day inactivity

        // Owner heartbeats at day 5
        test_scenario::next_tx(&mut scenario, OWNER);
        {
            let mut cap = test_scenario::take_shared<Capsule>(&scenario);
            clock::set_for_testing(&mut clock, T0 + 5 * ONE_DAY_MS);
            capsule::heartbeat(&mut cap, &clock, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(cap);
        };

        // Beneficiary tries to unlock at day 5 + 3 days (only 3 days of silence, needs 7)
        test_scenario::next_tx(&mut scenario, BENEFICIARY);
        {
            let mut cap = test_scenario::take_shared<Capsule>(&scenario);
            clock::set_for_testing(&mut clock, T0 + 5 * ONE_DAY_MS + 3 * ONE_DAY_MS);
            capsule::unlock(&mut cap, &clock, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(cap);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    /// TEST 6: Non-beneficiary cannot call unlock even when conditions are met
    #[test]
    #[expected_failure(abort_code = chaincapsule::capsule::E_NOT_BENEFICIARY)]
    fun test_unlock_rejects_non_beneficiary_even_when_unlockable() {
        let unlock_at = T0 + 100;
        let mut scenario = test_scenario::begin(OWNER);
        let mut clock = setup_time_capsule(&mut scenario, unlock_at);

        // Stranger2 (not the beneficiary) tries to unlock
        test_scenario::next_tx(&mut scenario, STRANGER2);
        {
            let mut cap = test_scenario::take_shared<Capsule>(&scenario);
            clock::set_for_testing(&mut clock, unlock_at + 1_000);
            capsule::unlock(&mut cap, &clock, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(cap);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    // ============================================================================
    // MODULE: capsule::is_unlockable (view helper) — 3 tests
    // ============================================================================

    /// TEST 1: is_unlockable returns false before fixed date
    #[test]
    fun test_is_unlockable_false_before_date() {
        let mut scenario = test_scenario::begin(OWNER);
        let mut clock = setup_time_capsule(&mut scenario, T0 + 10_000);

        test_scenario::next_tx(&mut scenario, OWNER);
        {
            let cap = test_scenario::take_shared<Capsule>(&scenario);
            clock::set_for_testing(&mut clock, T0 + 9_999);
            assert!(!capsule::is_unlockable(&cap, &clock), 0);
            test_scenario::return_shared(cap);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    /// TEST 2: is_unlockable returns true at exact fixed date
    #[test]
    fun test_is_unlockable_true_at_exact_date() {
        let mut scenario = test_scenario::begin(OWNER);
        let mut clock = setup_time_capsule(&mut scenario, T0 + 10_000);

        test_scenario::next_tx(&mut scenario, OWNER);
        {
            let cap = test_scenario::take_shared<Capsule>(&scenario);
            clock::set_for_testing(&mut clock, T0 + 10_000); // exact unlock time
            assert!(capsule::is_unlockable(&cap, &clock), 0);
            test_scenario::return_shared(cap);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    /// TEST 3: is_unlockable returns true for DMS after inactivity period
    #[test]
    fun test_is_unlockable_true_for_dms_after_silence() {
        let mut scenario = test_scenario::begin(OWNER);
        let mut clock = setup_dms_capsule(&mut scenario, 1); // 1 day

        test_scenario::next_tx(&mut scenario, OWNER);
        {
            let cap = test_scenario::take_shared<Capsule>(&scenario);
            // last_heartbeat = T0, 1 day = 86_400_000 ms, so unlockable at T0 + 86_400_000
            clock::set_for_testing(&mut clock, T0 + ONE_DAY_MS + 1);
            assert!(capsule::is_unlockable(&cap, &clock), 0);
            test_scenario::return_shared(cap);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    // ============================================================================
    // MODULE: Integration — Full lifecycle tests (3 tests)
    // ============================================================================

    /// INTEGRATION TEST 1: Full time-capsule lifecycle (create → wait → unlock)
    #[test]
    fun test_full_time_capsule_lifecycle() {
        let mut scenario = test_scenario::begin(OWNER);
        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, T0);

        // 1. Owner creates capsule
        capsule::create(
            string::utf8(b"integration-blob-1"),
            b"integration-key-1",
            BENEFICIARY,
            T0 + 60_000, // unlock in 60 seconds
            0,
            &clock,
            test_scenario::ctx(&mut scenario),
        );

        // 2. Verify it's locked before time
        test_scenario::next_tx(&mut scenario, BENEFICIARY);
        {
            let cap = test_scenario::take_shared<Capsule>(&scenario);
            clock::set_for_testing(&mut clock, T0 + 59_999);
            assert!(!capsule::is_unlockable(&cap, &clock), 0);
            test_scenario::return_shared(cap);
        };

        // 3. Verify it's unlockable after time passes
        test_scenario::next_tx(&mut scenario, BENEFICIARY);
        {
            let cap = test_scenario::take_shared<Capsule>(&scenario);
            clock::set_for_testing(&mut clock, T0 + 60_000);
            assert!(capsule::is_unlockable(&cap, &clock), 1);
            test_scenario::return_shared(cap);
        };

        // 4. Beneficiary unlocks
        test_scenario::next_tx(&mut scenario, BENEFICIARY);
        {
            let mut cap = test_scenario::take_shared<Capsule>(&scenario);
            capsule::unlock(&mut cap, &clock, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(cap);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    /// INTEGRATION TEST 2: Full dead man's switch lifecycle (create → heartbeat → silence → unlock)
    #[test]
    fun test_full_dms_lifecycle_with_heartbeats() {
        let mut scenario = test_scenario::begin(OWNER);
        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, T0);

        // 1. Owner creates DMS capsule with 2-day inactivity
        capsule::create(
            string::utf8(b"dms-blob-integration"),
            b"dms-key-integration",
            BENEFICIARY,
            0,
            2, // 2-day inactivity
            &clock,
            test_scenario::ctx(&mut scenario),
        );

        // 2. Owner sends heartbeats at day 1 — capsule stays locked
        test_scenario::next_tx(&mut scenario, OWNER);
        {
            let mut cap = test_scenario::take_shared<Capsule>(&scenario);
            clock::set_for_testing(&mut clock, T0 + ONE_DAY_MS);
            capsule::heartbeat(&mut cap, &clock, test_scenario::ctx(&mut scenario));

            // Verify not yet unlockable (only 0 days since last heartbeat)
            clock::set_for_testing(&mut clock, T0 + ONE_DAY_MS + 1);
            assert!(!capsule::is_unlockable(&cap, &clock), 0);
            test_scenario::return_shared(cap);
        };

        // 3. Owner goes silent. 2 days after last heartbeat, beneficiary can unlock
        test_scenario::next_tx(&mut scenario, BENEFICIARY);
        {
            let mut cap = test_scenario::take_shared<Capsule>(&scenario);
            // last_heartbeat = T0 + ONE_DAY_MS, so unlockable at T0 + ONE_DAY_MS + 2*ONE_DAY_MS
            clock::set_for_testing(&mut clock, T0 + 3 * ONE_DAY_MS + 1);
            assert!(capsule::is_unlockable(&cap, &clock), 1);

            capsule::unlock(&mut cap, &clock, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(cap);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    /// INTEGRATION TEST 3: Owner heartbeat resets timer, delaying unlock
    #[test]
    fun test_heartbeat_delays_dms_unlock() {
        let mut scenario = test_scenario::begin(OWNER);
        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, T0);

        // 1. Create DMS with 1-day inactivity
        capsule::create(
            string::utf8(b"delay-test-blob"),
            b"delay-test-key",
            BENEFICIARY,
            0,
            1, // 1-day inactivity
            &clock,
            test_scenario::ctx(&mut scenario),
        );

        // 2. At 23 hours, beneficiary checks — not yet unlockable
        test_scenario::next_tx(&mut scenario, BENEFICIARY);
        {
            let cap = test_scenario::take_shared<Capsule>(&scenario);
            clock::set_for_testing(&mut clock, T0 + 23 * 3_600_000);
            assert!(!capsule::is_unlockable(&cap, &clock), 0);
            test_scenario::return_shared(cap);
        };

        // 3. At 25 hours, would be unlockable — but owner heartbeats at 23.5 hours
        test_scenario::next_tx(&mut scenario, OWNER);
        {
            let mut cap = test_scenario::take_shared<Capsule>(&scenario);
            clock::set_for_testing(&mut clock, T0 + 23 * 3_600_000 + 1_800_000); // 23.5 hrs
            capsule::heartbeat(&mut cap, &clock, test_scenario::ctx(&mut scenario));
            test_scenario::return_shared(cap);
        };

        // 4. Now at T0 + 25 hours — would have been unlockable WITHOUT heartbeat,
        //    but the heartbeat reset the timer. Beneficiary checks — still locked.
        test_scenario::next_tx(&mut scenario, BENEFICIARY);
        {
            let cap = test_scenario::take_shared<Capsule>(&scenario);
            clock::set_for_testing(&mut clock, T0 + 25 * 3_600_000);
            // last_heartbeat = T0 + 23.5hrs, so need 24hrs more → unlockable at T0 + 47.5hrs
            assert!(!capsule::is_unlockable(&cap, &clock), 1);
            test_scenario::return_shared(cap);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }
}
