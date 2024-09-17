import { exceptionAlert } from "../../utils/helpers/exceptionAlert";
import type { Bladeburner } from "../Bladeburner";
import { Skills } from "../data/Skills";
import { formatNumberNoSuffix } from "../../ui/formatNumber";
import { getEnumHelper } from "../../utils/EnumHelper";
import { ConsoleHelpText } from "../data/Help";
import { autoCompleteTypeShorthand } from "../utils/terminalShorthands";
import { parseCommand } from "../../Terminal/Parser";

export function executeCommands(commands: string, blade: Bladeburner) {
  try {
    // Console History
    if (blade.consoleHistory[blade.consoleHistory.length - 1] != commands) {
      blade.consoleHistory.push(commands);
      if (blade.consoleHistory.length > 50) {
        blade.consoleHistory.splice(0, 1);
      }
    }

    const arrayOfCommands = commands.split(";");
    for (let i = 0; i < arrayOfCommands.length; ++i) {
      execute(arrayOfCommands[i], blade);
    }
  } catch (e: unknown) {
    exceptionAlert(e);
  }
}

function execute(command: string, blade: Bladeburner): void {
  command = command.trim();
  command = command.replace(/\s\s+/g, " "); // Replace all whitespace w/ a single space

  const args = parseCommand(command).map(String);
  if (args.length <= 0) return; // Log an error?

  switch (args[0].toLowerCase()) {
    case "automate":
      automateCommand(blade, args);
      break;
    case "clear":
    case "cls":
      blade.clearConsole();
      break;
    case "help":
      helpCommand(blade, args);
      break;
    case "log":
      logCommand(blade, args);
      break;
    case "skill":
      skillCommand(blade, args);
      break;
    case "start":
      startCommand(blade, args);
      break;
    case "stop":
      blade.resetAction();
      break;
    default:
      blade.postToConsole("Invalid console command");
      break;
  }
}

export function startCommand(blade: Bladeburner, args: string[]) {
  if (args.length !== 3) {
    blade.postToConsole("Invalid usage of 'start' console command: start [type] [name]");
    blade.postToConsole("Use 'help start' for more info");
    return;
  }
  const type = args[1];
  const name = args[2];
  const action = blade.getActionFromTypeAndName(type, name);
  if (!action) {
    blade.postToConsole(`Invalid action type / name specified: type: ${type}, name: ${name}`);
    return;
  }
  const attempt = blade.startAction(action.id);
  blade.postToConsole(attempt.message);
}

export function skillCommand(blade: Bladeburner, args: string[]) {
  switch (args.length) {
    case 1: {
      // Display Skill Help Command
      blade.postToConsole("Invalid usage of 'skill' console command: skill [action] [name]");
      blade.postToConsole("Use 'help skill' for more info");
      break;
    }
    case 2: {
      if (args[1].toLowerCase() === "list") {
        // List all skills and their level
        blade.postToConsole("Skills: ");
        for (const skill of Object.values(Skills)) {
          const skillLevel = blade.getSkillLevel(skill.name);
          blade.postToConsole(`${skill.name}: Level ${formatNumberNoSuffix(skillLevel, 0)}\n\nEffects: `);
        }
        for (const logEntry of blade.getSkillMultsDisplay()) blade.postToConsole(logEntry);
      } else {
        blade.postToConsole("Invalid usage of 'skill' console command: skill [action] [name]");
        blade.postToConsole("Use 'help skill' for more info");
      }
      break;
    }
    case 3: {
      const skillName = args[2];
      if (!getEnumHelper("BladeburnerSkillName").isMember(skillName)) {
        blade.postToConsole("Invalid skill name (Note that it is case-sensitive): " + skillName);
        return;
      }
      const level = blade.getSkillLevel(skillName);
      if (args[1].toLowerCase() === "list") {
        blade.postToConsole(skillName + ": Level " + formatNumberNoSuffix(level));
      } else if (args[1].toLowerCase() === "level") {
        const attempt = blade.upgradeSkill(skillName);
        blade.postToConsole(attempt.message);
      } else {
        blade.postToConsole("Invalid usage of 'skill' console command: skill [action] [name]");
        blade.postToConsole("Use 'help skill' for more info");
      }
      break;
    }
    default: {
      blade.postToConsole("Invalid usage of 'skill' console command: skill [action] [name]");
      blade.postToConsole("Use 'help skill' for more info");
      break;
    }
  }
}

export function logCommand(blade: Bladeburner, args: string[]) {
  if (args.length < 3) {
    blade.postToConsole("Invalid usage of log command: log [enable/disable] [action/event]");
    blade.postToConsole("Use 'help log' for more details and examples");
    return;
  }

  let flag = true;
  if (args[1].toLowerCase().includes("d")) {
    flag = false;
  } // d for disable

  switch (args[2].toLowerCase()) {
    case "general":
    case "gen":
      blade.logging.general = flag;
      blade.log("Logging " + (flag ? "enabled" : "disabled") + " for general actions");
      break;
    case "contract":
    case "contracts":
      blade.logging.contracts = flag;
      blade.log("Logging " + (flag ? "enabled" : "disabled") + " for Contracts");
      break;
    case "ops":
    case "op":
    case "operations":
    case "operation":
      blade.logging.ops = flag;
      blade.log("Logging " + (flag ? "enabled" : "disabled") + " for Operations");
      break;
    case "blackops":
    case "blackop":
    case "black operations":
    case "black operation":
      blade.logging.blackops = flag;
      blade.log("Logging " + (flag ? "enabled" : "disabled") + " for BlackOps");
      break;
    case "event":
    case "events":
      blade.logging.events = flag;
      blade.log("Logging " + (flag ? "enabled" : "disabled") + " for events");
      break;
    case "all":
      blade.logging.general = flag;
      blade.logging.contracts = flag;
      blade.logging.ops = flag;
      blade.logging.blackops = flag;
      blade.logging.events = flag;
      blade.log("Logging " + (flag ? "enabled" : "disabled") + " for everything");
      break;
    default:
      blade.postToConsole("Invalid action/event type specified: " + args[2]);
      blade.postToConsole(
        "Examples of valid action/event identifiers are: [general, contracts, ops, blackops, events]",
      );
      break;
  }
}

export function helpCommand(blade: Bladeburner, args: string[]) {
  if (args.length === 1) {
    for (const line of ConsoleHelpText.helpList) {
      blade.postToConsole(line);
    }
  } else {
    for (let i = 1; i < args.length; ++i) {
      if (!(args[i] in ConsoleHelpText)) continue;
      const helpText = ConsoleHelpText[args[i]];
      for (const line of helpText) {
        blade.postToConsole(line);
      }
    }
  }
}

export function automateCommand(blade: Bladeburner, args: string[]) {
  if (args.length !== 2 && args.length !== 4) {
    blade.postToConsole(
      "Invalid use of 'automate' command: automate [var] [val] [hi/low]. Use 'help automate' for more info",
    );
    return;
  }

  // Enable/Disable
  if (args.length === 2) {
    const flag = args[1];
    if (flag.toLowerCase() === "status") {
      blade.postToConsole("Automation: " + (blade.automateEnabled ? "enabled" : "disabled"));
      blade.postToConsole(
        "When your stamina drops to " +
          formatNumberNoSuffix(blade.automateThreshLow, 0) +
          ", you will automatically switch to " +
          (blade.automateActionLow?.name ?? "Idle") +
          ". When your stamina recovers to " +
          formatNumberNoSuffix(blade.automateThreshHigh, 0) +
          ", you will automatically " +
          "switch to " +
          (blade.automateActionHigh?.name ?? "Idle") +
          ".",
      );
    } else if (flag.toLowerCase().includes("en")) {
      if (!blade.automateActionLow || !blade.automateActionHigh) {
        return blade.log("Failed to enable automation. Actions were not set");
      }
      blade.automateEnabled = true;
      blade.log("Bladeburner automation enabled");
    } else if (flag.toLowerCase().includes("d")) {
      blade.automateEnabled = false;
      blade.log("Bladeburner automation disabled");
    } else {
      blade.log("Invalid argument for 'automate' console command: " + args[1]);
    }
    return;
  }

  // Set variables
  if (args.length === 4) {
    const type = args[1].toLowerCase(); // allows Action Type to be with or without capitalization.
    const name = args[2];

    let highLow = false; // True for high, false for low
    if (args[3].toLowerCase().includes("hi")) {
      highLow = true;
    }

    if (type === "stamina") {
      // For stamina, the "name" variable is actually the stamina threshold
      if (isNaN(parseFloat(name))) {
        blade.postToConsole("Invalid value specified for stamina threshold (must be numeric): " + name);
      } else {
        if (highLow) {
          blade.automateThreshHigh = Number(name);
        } else {
          blade.automateThreshLow = Number(name);
        }
        blade.log("Automate (" + (highLow ? "HIGH" : "LOW") + ") stamina threshold set to " + name);
      }
      return;
    }

    const actionId = autoCompleteTypeShorthand(type, name);

    if (actionId === null) {
      switch (type) {
        case "general":
        case "gen": {
          blade.postToConsole("Invalid General Action name specified: " + name);
          return;
        }
        case "contract":
        case "contracts": {
          blade.postToConsole("Invalid Contract name specified: " + name);
          return;
        }
        case "ops":
        case "op":
        case "operations":
        case "operation":
          blade.postToConsole("Invalid Operation name specified: " + name);
          return;
        default:
          blade.postToConsole("Invalid use of automate command.");
          return;
      }
    }

    if (highLow) {
      blade.automateActionHigh = actionId;
    } else {
      blade.automateActionLow = actionId;
    }
    blade.log("Automate (" + (highLow ? "HIGH" : "LOW") + ") action set to " + name);
  }
}
