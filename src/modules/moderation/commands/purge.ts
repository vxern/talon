import { Client } from "../../../client/client";

import { Moderation } from "../moderation";
import { Command, HandlingData } from "../../command";

import { Utils } from "../../../utils";

export class Purge extends Command<Moderation> {
  readonly identifier = 'purge';
  readonly aliases = ['delete'];
  readonly description = 'Deletes a specified number of messages from a channel.';
  readonly parameters = ['number', 'optional: quiet'];
  readonly handler = this.purge;

  async purge({message, parameters}: HandlingData) {
    const numberToDelete = Utils.resolveNumber(message.channel, parameters.get('number')!);
    if (numberToDelete === null) return;

    const iterations = Math.floor(numberToDelete! / 100);
    let deleted = 0;
    for (let iteration = 0; iteration < iterations; iteration++) {
      deleted += (await message.channel.bulkDelete(100).catch().finally()).size;
    }

    const leftAfterBulkDeletion = numberToDelete! - 100 * iterations + 1;

    deleted += (await message.channel.bulkDelete(leftAfterBulkDeletion).catch().finally()).size;

    if (!parameters.get('quiet')) {
      Client.info(message.channel, `${Utils.pluralise('message has', deleted - 1, 'messages have')} been cleared.`);
    }
  }
}