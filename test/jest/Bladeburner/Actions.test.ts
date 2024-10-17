import { Bladeburner } from "../../../src/Bladeburner/Bladeburner";
import { PlayerObject } from "../../../src/PersonObjects/Player/PlayerObject";
import { Player, setPlayer } from "@player";
import { BlackOperation, Contract, GeneralAction, Operation } from "../../../src/Bladeburner/Actions";
import {
  BladeburnerActionType,
  BladeburnerContractName,
  BladeburnerGeneralActionName,
  BladeburnerOperationName,
  BladeburnerSkillName,
  CityName,
  CrimeType,
} from "@enums";
import { FormatsNeedToChange } from "../../../src/ui/formatNumber";
import { CrimeWork } from "../../../src/Work/CrimeWork";
import type { Action, ActionIdentifier } from "../../../src/Bladeburner/Types";
import type { Skills } from "@nsdefs";
import { BlackOperations } from "../../../src/Bladeburner/data/BlackOperations";

describe("Bladeburner Actions", () => {
  const SampleContract = Contract.createId(BladeburnerContractName.Tracking);
  const SampleGeneralAction = GeneralAction.createId(BladeburnerGeneralActionName.Diplomacy);
  const SampleOperation = Operation.createId(BladeburnerOperationName.Assassination);
  const SampleBlackOp = BlackOperations["Operation Centurion"].id;
  const ENOUGH_TIME_TO_FINISH_ACTION = 1e5;

  /** Why 1e14? The stat tests need to be able to detect an EXP change of cca. 0.01
   * 1e14 is the last threshold where 1e14 + 0.01 > 1e14
   *
   * Bug? Coincidentally this also means that stat gains stop at that level unless
   * exp multipliers play a significant role
   *
   * Example: 1e14 strength exp gives ~~831 strength skill without augs/modifiers
   */
  const HIGH_STAT_EXP = 1e14;
  const LOW_STAT_EXP = 1e6;

  let inst: Bladeburner;

  const instanceUsedForTestGeneration = new Bladeburner();
  const CITIES = <CityName[]>Object.keys(instanceUsedForTestGeneration.cities);

  /** All the tests depend on this assumption */
  it("always succeeds with optimal stats, rank, stamina and city chaos levels", () => {
    guaranteeSuccess(), complete(SampleOperation);
    const action = inst.getActionObject(SampleOperation);
    expect(action.getSuccessChance(inst, Player, { est: false })).toBe(1);
    expect(action.successes).toBeGreaterThan(0);
  });

  describe("Without Simulacrum", () => {
    it("Starting an action cancels player's work immediately", () => {
      Player.startWork(new CrimeWork({ crimeType: CrimeType.assassination, singularity: false }));
      start(SampleGeneralAction);
      expect(Player.currentWork).toBeNull();
    });
  });

  describe("Upon successful completion", () => {
    /** Repetitive snapshot declarations in most tests below */
    let pop, before, after;

    describe(BladeburnerGeneralActionName.Training, () => {
      const Training = GeneralAction.createId(BladeburnerGeneralActionName.Training);

      it("increases max stamina", () => {
        basicStats(), (before = inst.maxStamina), complete(Training);
        expect(inst.maxStamina).toBeGreaterThan(before);
      });

      it.each(<(keyof Skills)[]>["strength", "dexterity", "agility"])("awards %s exp", (stat: keyof Skills) => {
        guaranteeSuccess(), (before = Player.exp[stat]), complete(Training);
        expect(Player.exp[stat]).toBeGreaterThan(before);
      });
    });

    describe(BladeburnerGeneralActionName.HyperbolicRegen, () => {
      const Regen = GeneralAction.createId(BladeburnerGeneralActionName.HyperbolicRegen);

      it("heals the player", () => {
        basicStats(), Player.takeDamage(Player.hp.max / 2), (before = Player.hp.current), complete(Regen);
        expect(Player.hp.current).toBeGreaterThan(before);
      });

      it("regains stamina", () => {
        basicStats(), (inst.stamina = 0), complete(Regen);
        expect(inst.stamina).toBeGreaterThan(0);
      });
    });

    describe(BladeburnerGeneralActionName.Diplomacy, () => {
      const Diplomacy = GeneralAction.createId(BladeburnerGeneralActionName.Diplomacy);

      it("mildly reduces chaos in the current city", () => {
        let chaos;
        basicStats(), allCitiesHighChaos(), ({ chaos } = inst.getCurrentCity()), complete(Diplomacy);
        expect(inst.getCurrentCity().chaos).toBeGreaterThan(chaos * 0.9);
        expect(inst.getCurrentCity().chaos).toBeLessThan(chaos);
      });

      it("effect scales significantly with player charisma", () => {
        basicStats(), Player.gainCharismaExp(1e500), allCitiesHighChaos(), complete(Diplomacy);
        expect(inst.getCurrentCity().chaos).toBe(0);
      });

      it("does NOT affect chaos in other cities", () => {
        const otherCity = <CityName>CITIES.find((c) => c !== inst.getCurrentCity().name);
        /** Testing against a guaranteed 0-chaos level of charisma */
        basicStats(), Player.gainCharismaExp(1e500), allCitiesHighChaos(), complete(Diplomacy);
        expect(inst.cities[otherCity].chaos).toBeGreaterThan(0);
      });
    });

    describe(BladeburnerGeneralActionName.FieldAnalysis, () => {
      const Field = GeneralAction.createId(BladeburnerGeneralActionName.FieldAnalysis);

      it("improves population estimate", () => {
        basicStats(),
          ({ pop, popEst: before } = inst.getCurrentCity()),
          complete(Field),
          finish(),
          ({ popEst: after } = inst.getCurrentCity());
        expect(Math.abs(after - pop)).toBeLessThan(Math.abs(before - pop));
      });

      it.each(<(keyof Skills)[]>["hacking", "charisma"])("awards %s exp", (stat: keyof Skills) => {
        basicStats(), (before = Player.exp[stat]), complete(Field);
        expect(Player.exp[stat]).toBeGreaterThan(before);
      });

      it("provides a minor increase in rank", () => {
        basicStats(), ({ rank: before } = inst), complete(Field);
        expect(inst.rank).toBeGreaterThan(before);
      });
    });

    describe.each([SampleContract, SampleOperation, BlackOperations["Operation Archangel"].id])(
      "non-general actions increase rank",
      (id) => {
        it(`${id.type}`, () => {
          guaranteeSuccess(), (before = inst.rank), complete(id);
          expect(inst.rank).toBeGreaterThan(before);
        });
      },
    );

    describe("non-general actions increase rank", () => {
      let beforeMinor, minorGain, beforeMajor, majorGain;

      it.each([
        { major: SampleBlackOp, minor: SampleOperation },
        { major: SampleOperation, minor: SampleContract },
      ])("$major.type reward significantly more rank than $minor.type", ({ major, minor }) => {
        guaranteeSuccess(), (beforeMinor = inst.rank), complete(minor), finish(), (minorGain = inst.rank - beforeMinor);
        guaranteeSuccess(), (beforeMajor = inst.rank), complete(major), finish(), (majorGain = inst.rank - beforeMajor);
        expect(majorGain).toBeGreaterThan(minorGain);
      });
    });

    describe(BladeburnerGeneralActionName.InciteViolence, () => {
      const Incite = GeneralAction.createId(BladeburnerGeneralActionName.InciteViolence);
      let chaos;

      it("generates available contracts", () => {
        const { count } = inst.getActionObject(SampleContract);
        guaranteeSuccess(), complete(Incite);
        expect(inst.getActionObject(SampleContract).count).toBeGreaterThan(count);
      });

      it("generates available operations", () => {
        const { count } = inst.getActionObject(SampleOperation);
        guaranteeSuccess(), complete(Incite);
        expect(inst.getActionObject(SampleOperation).count).toBeGreaterThan(count);
      });

      /** Relates to all issues mentioned in PR-1586 */
      it.each(CITIES)("SIGNIFICANTLY increases chaos in all cities when chaos is LOW: %s", (city: CityName) => {
        guaranteeSuccess(), ({ chaos } = inst.cities[city]), complete(Incite);
        expect(inst.cities[city].chaos).toBeGreaterThan(chaos * 2);
      });

      /** Relates to all issues mentioned in PR-1586 */
      it.each(CITIES)("MILDLY increases chaos in all cities when chaos is HIGH: %s", (city: CityName) => {
        guaranteeSuccess(), allCitiesHighChaos(), ({ chaos } = inst.cities[city]), complete(Incite);
        expect(inst.cities[city].chaos).toBeGreaterThan(chaos * 1.05);
      });
    });

    describe(BladeburnerGeneralActionName.Recruitment, () => {
      const Recruitment = GeneralAction.createId(BladeburnerGeneralActionName.Recruitment);

      it("awards charisma exp", () => {
        guaranteeSuccess(), (before = Player.exp.charisma), complete(Recruitment);
        expect(Player.exp.charisma).toBeGreaterThan(before);
      });

      it("hires team member", () => {
        guaranteeSuccess(), complete(Recruitment);
        expect(inst.teamSize).toBeGreaterThan(0);
      });
    });

    describe.each([...actionId(contracts())])("$id.name", ({ id }) => {
      it("all contracts award money", () => {
        guaranteeSuccess(), (before = Player.money), complete(id);
        expect(Player.money).toBeGreaterThan(before);
      });
    });

    /** Stat EXP check for all actions */
    /** Checking all of them to avoid regressions */
    describe.each([...actionIdWithIndividualStat(nonGeneralActions())])("$id.name", ({ id, stat }) => {
      it(`awards ${stat} exp`, () => {
        guaranteeSuccess(), (before = Player.exp[stat]), complete(id);
        expect(Player.exp[stat]).toBeGreaterThan(before);
      });
    });
  });

  describe("Upon failed completion", () => {
    let before;

    describe.each([SampleOperation, SampleBlackOp])("operations and black operations decrease rank", (id) => {
      it(`${id.type}`, () => {
        guaranteeFailure(), (before = inst.rank), complete(id);
        expect(inst.rank).toBeLessThan(before);
      });
    });
  });

  it("have a minimum duration of 1 second", () => {
    complete(SampleContract);
    expect(inst.actionTimeToComplete).toBeGreaterThanOrEqual(1);
  });

  beforeAll(() => {
    /* Initialise Formatters. Dependency of Bladeburner Logs/Console */
    FormatsNeedToChange.emit();
  });

  beforeEach(() => {
    setPlayer(new PlayerObject());

    /** Need BN5 to receive Int EXP */
    Player.sourceFiles.set(5, 3);

    if (initBladeburner(Player)) {
      inst = Player.bladeburner;
      inst.clearConsole();
    }
  });

  function initBladeburner(player: PlayerObject): player is PlayerObject & { bladeburner: Bladeburner } {
    player.startBladeburner();
    return true;
  }

  function basicStats() {
    inst.rank = 1;
    inst.changeRank(Player, 10);
    Player.gainStrengthExp(LOW_STAT_EXP);
    Player.gainDefenseExp(LOW_STAT_EXP);
    Player.gainAgilityExp(LOW_STAT_EXP);
    Player.gainDexterityExp(LOW_STAT_EXP);

    inst.calculateMaxStamina();
    inst.stamina = inst.maxStamina;

    resetCity();
  }

  function guaranteeSuccess() {
    inst.rank = 1;
    inst.changeRank(Player, 1e10);

    Player.gainStrengthExp(HIGH_STAT_EXP);
    Player.gainDefenseExp(HIGH_STAT_EXP);
    Player.gainAgilityExp(HIGH_STAT_EXP);
    Player.gainDexterityExp(HIGH_STAT_EXP);
    inst.setSkillLevel(BladeburnerSkillName.BladesIntuition, 1e12);
    inst.setSkillLevel(BladeburnerSkillName.Cloak, 1e12);
    inst.setSkillLevel(BladeburnerSkillName.DigitalObserver, 1e12);
    inst.setSkillLevel(BladeburnerSkillName.Reaper, 1e12);

    inst.calculateMaxStamina();
    inst.stamina = inst.maxStamina;

    resetCity();
  }

  function guaranteeFailure() {
    inst.rank = 1;
    inst.changeRank(Player, 400e3); // Minimum to attempt to fail hardest op
    Player.gainAgilityExp(1e50);
    inst.calculateMaxStamina();
    inst.stamina = 0;

    resetCity();
  }

  function resetCity() {
    inst.cities[inst.city].chaos = 0;
    inst.cities[inst.city].comms = 100;
    inst.cities[inst.city].pop = 1e9;

    /** Disable random event */
    inst.randomEventCounter = Infinity;
  }

  function allCitiesHighChaos() {
    for (const city of Object.values(inst.cities)) {
      city.chaos = 1e12;
    }
  }

  function complete(id: ActionIdentifier) {
    start(id), finish();
  }

  function start(id: ActionIdentifier) {
    const action = inst.getActionObject(id);
    if ("count" in action) action.count = 1;
    if (action.type === BladeburnerActionType.Operation) action.autoLevel = true;
    if (id.type === "Black Operations") inst.numBlackOpsComplete = (<BlackOperation>action).n;
    inst.startAction(id);
  }

  function finish() {
    inst.processAction(ENOUGH_TIME_TO_FINISH_ACTION);
    inst.calculateMaxStamina();
  }

  function* nonGeneralActions() {
    yield* contracts();
    yield* operations();
    yield* Object.values(BlackOperations);
  }

  function* contracts() {
    yield* Object.values(instanceUsedForTestGeneration.contracts);
  }

  function* operations() {
    yield* Object.values(instanceUsedForTestGeneration.operations);
  }

  function* actionId(actions: Iterable<Action>) {
    for (const action of actions) yield { id: action.id };
  }

  function* actionIdWithIndividualStat(actions: Iterable<Action>) {
    for (const action of actions) {
      yield* Object.entries(action.weights)
        .filter(([__, value]) => value > 0)
        .map(([stat]) => ({ id: action.id, stat } as { id: ActionIdentifier; stat: keyof Skills }));
    }
  }
});
