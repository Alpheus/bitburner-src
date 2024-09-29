import type { Bladeburner } from "../../../src/Bladeburner/Bladeburner";
import { PlayerObject } from "../../../src/PersonObjects/Player/PlayerObject";
import { Player, setPlayer } from "@player";
import { Contract } from "../../../src/Bladeburner/Actions";
import { BladeburnerContractName } from "@enums";
import { FormatsNeedToChange } from "../../../src/ui/formatNumber";

describe("Bladeburner Actions", () => {
  const REASONABLE_TIME_TO_COMPLETE_ANY_ACTION = 1e50;

  let inst: Bladeburner;

  function initBladeburner(player: PlayerObject): player is PlayerObject & { bladeburner: Bladeburner } {
    player.init();
    player.startBladeburner();
    return true;
  }

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

  it("an action is never instant", () => {
    inst.startAction(Contract.createId(BladeburnerContractName.Tracking));
    inst.getActionObject(Contract.createId(BladeburnerContractName.Tracking)).count = 5;
    inst.clearConsole();
    inst.processAction(0);
  });
});
