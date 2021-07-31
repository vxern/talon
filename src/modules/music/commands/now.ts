import { Client } from "../../../client/client";
import { Embed } from "../../../client/embed";

import { Music } from "../music";
import { Command } from "../../command";

export class Now extends Command<Music> {
  readonly identifier = 'now';
  readonly aliases = ['current', 'song'];
  readonly description = 'Display the song currently playing';
  readonly arguments = [];
  readonly dependencies = [];
  readonly handler = this.displayNowPlaying;

  /// Displays the current playing song
  async displayNowPlaying() {
    let listingString = 'No song is playing currently';
    
    if (this.module.currentSong !== undefined) {
      listingString = `${this.module.currentSong.title} (${this.module.runningTimeAsString()})`;
    }

    if (this.module.voiceConnection?.dispatcher?.paused) {
      listingString = ':pause_button: ' + listingString;
    }

    Client.send(this.module.textChannel!, Embed.singleField({
      name: 'Now Playing',
      value: listingString,
      inline: false,
    }));
  }
}