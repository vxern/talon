
import moment from "moment";

import { Client } from "../../../client/client";

import { Warning } from "../../../database/structs/warning";

import { Moderation } from "../moderation";
import { Command, HandlingData } from "../../command";
import { Ban } from "./ban";

import { Utils } from "../../../utils";

import config from '../../../config.json';

export class Warn extends Command<Moderation> {
  readonly identifier = 'warn';
  readonly aliases = [];
  readonly description = 'Warns a user.';
  readonly parameters = ['identifier', 'reason'];
  readonly handler = this.warn;

  async warn({message, parameters}: HandlingData) {
    const member = await Moderation.resolveMember(message, parameters.get('identifier')!);

    if (member === undefined) {
      return;
    }

    if (Utils.isModerator(member)) {
      Client.warn(message.channel, 'You do not have the authority to warn this member.');
      return;
    }

    Client.database.fetchOrCreateDocument(member.user).then((document) => {
      if (document === undefined) return;

      const numberOfWarnings = document.user.warnings.length + 1;

      if (numberOfWarnings === 3) {
        Client.commands.get('Ban').ban({
          message: message,
          parameters: new Map([
            ['identifier', member.id],
            ['reason', 'Violating the rules on three occasions']
          ]),
        });
        return;
      }

      const reason = parameters.get('reason')!;
      const expiryTime = moment().add(config.warningExpiryInMonths, 'months');

      document.user.warnings.push(new Warning({
        reason: reason,
        expiresAt: expiryTime,
      }));

      Client.database.update(document);

      Client.warn(message.channel, 
        `${Utils.toUserTag(member.id)} has been warned for: ${reason}\n\n` +
        `${Utils.toUserTag(member.id)} now has ${Utils.pluralise('warning', numberOfWarnings)}`
      );
    });
  }
}