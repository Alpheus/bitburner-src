import type { Bladeburner } from "../../../src/Bladeburner/Bladeburner";
import { PlayerObject } from "../../../src/PersonObjects/Player/PlayerObject";
import { Player, setPlayer } from "@player";
import { Contract, GeneralAction, Operation } from "../../../src/Bladeburner/Actions";
import { BladeburnerContractName, BladeburnerGeneralActionName, BladeburnerOperationName, CrimeType } from "@enums";
import { FormatsNeedToChange } from "../../../src/ui/formatNumber";
import { CrimeWork } from "../../../src/Work/CrimeWork";
import type { ActionIdentifier } from "../../../src/Bladeburner/Types";
import type { Skills } from "../../../src/PersonObjects/Skills";

type StatKey = keyof Skills;

describe("Bladeburner Actions", () => {
  const Tracking = Contract.createId(BladeburnerContractName.Tracking);
  const Diplomacy = GeneralAction.createId(BladeburnerGeneralActionName.Diplomacy);
  const Assassination = Operation.createId(BladeburnerOperationName.Assassination);
  const Recruitment = GeneralAction.createId(BladeburnerGeneralActionName.Recruitment);
  const ENOUGH_TIME_TO_FINISH_ACTION = 1e5;

  let inst: Bladeburner;

  /** All the tests depend on this assumption */
  it("always succeeds with optimal stats, rank, stamina and city chaos levels", () => {
    guaranteeSuccess(), start(Assassination), finish();
    expect(inst.getActionObject(Assassination).getSuccessChance(inst, Player, { est: false })).toBe(1);
  });

  describe("Without Simulacrum", () => {
    it("Starting an action cancels player's work immediately", () => {
      Player.startWork(new CrimeWork({ crimeType: CrimeType.assassination, singularity: false }));
      start(Diplomacy);
      expect(Player.currentWork).toBeNull();
    });
  });

  describe("Upon successful completion", () => {
    it("Contracts give the player money", () => {
      const moneyBefore = Player.money;
      guaranteeSuccess(), start(Tracking), finish();
      expect(Player.money).toBeGreaterThan(moneyBefore);
    });

    it.each(<StatKey[]>["strength", "dexterity", "defense", "dexterity"])(
      "Operations provide combat skill XP: %s",
      (stat: StatKey) => {
        const statsBefore = Object.assign({}, Player.skills);
        guaranteeSuccess(), start(Assassination), finish();
        expect(Player.skills[stat]).toBeGreaterThan(statsBefore[stat]);
      },
    );

    describe("Recruitment", () => {
      it("provides charisma", () => {
        const { charisma } = Player.skills;
        guaranteeSuccess(), start(Recruitment), finish();
        expect(Player.skills.charisma).toBeGreaterThan(charisma);
      });

      it("hires team member", () => {
        guaranteeSuccess(), start(Recruitment), finish();
        expect(inst.teamSize).toBeGreaterThan(0);
      });
    });
  });

  it("have a minimum duration of 1 second", () => {
    start(Tracking);
    expect(inst.actionTimeToComplete).toBeGreaterThanOrEqual(1);
  });

  beforeAll(() => {
    /* Initialise Formatters. Dependency of Bladeburner */
    FormatsNeedToChange.emit();
  });

  beforeEach(() => {
    setPlayer(new PlayerObject());
    if (initBladeburner(Player)) {
      inst = Player.bladeburner;
      inst.clearConsole();
    }
  });

  function initBladeburner(player: PlayerObject): player is PlayerObject & { bladeburner: Bladeburner } {
    player.init();
    player.startBladeburner();
    return true;
  }

  function guaranteeSuccess() {
    Player.gainStrengthExp(1e200);
    Player.gainAgilityExp(1e200);
    Player.gainDexterityExp(1e200);
    Player.gainDefenseExp(1e200);
    inst.calculateMaxStamina();
    inst.stamina = inst.maxStamina;
    inst.rank = 1e10;
    inst.cities[inst.city].chaos = 0;
    inst.cities[inst.city].comms = 100;
    inst.cities[inst.city].pop = 1e9;
  }

  function start(id: ActionIdentifier) {
    const action = inst.getActionObject(id);
    if ("count" in action) action.count = 1;
    inst.startAction(id);
  }

  function finish() {
    inst.processAction(ENOUGH_TIME_TO_FINISH_ACTION);
  }
});
