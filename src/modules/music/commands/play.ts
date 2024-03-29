import { StreamOptions, TextChannel } from "discord.js";
import { YTSearcher, YTSearch } from "ytsearcher";
import ytdl from 'ytdl-core';

import { Client, GuildMessage } from "../../../client/client";

import { Module } from "../../module";
import { Music } from "../music";
import { Command, HandlingData } from "../../command";
import { Song, Listing } from "../songs";

import { Utils } from "../../../utils";

const spotifyPattern: RegExp = /https:\/\/open.spotify.com\//;
const youtubePattern: RegExp = /http(?:s?):\/\/(?:www\.)?youtu(?:be\.com\/watch\?v=|\.be\/)([\w\-\_]*)(&(amp;)?‌​[\w\?‌​=]*)?/;

export class Play extends Command<Music> {
  readonly identifier = 'play';
  readonly aliases = ['request'];
  readonly description = 'Requests to play a song by providing a direct link to it, or by searching using keywords.';
  readonly parameters = ['song'];
  readonly handler = this.request;

  readonly searcher: YTSearcher = new YTSearcher(process.env.YOUTUBE_SECRET!);

  async request({message, parameter}: HandlingData) {
    await this.module.bindToVoiceChannel(message.channel, message.member!.voice!.channel!);

    const listing = await this.resolveQueryToListing(message, parameter!);

    if (listing === undefined) return;

    this.play(message.channel, listing);
  }

  async resolveQueryToListing(message: GuildMessage, parameter: string): Promise<Listing | undefined> {
    if (spotifyPattern.test(parameter)) {
      // TODO: Handle Spotify link here
      return;
    }

    const youtubeUrl = await this.searchYoutube(message);

    if (youtubeUrl === undefined) return;

    const videoInfo = await ytdl.getInfo(youtubeUrl);

    return new Listing(Song.fromYoutubeDetails(videoInfo.videoDetails), this.module.usersPresent());
  }

  async searchYoutube(message: GuildMessage): Promise<string | undefined> {
    if (youtubePattern.test(message.content)) return message.content;

    /// YTSearcher.search() is marked as a synchronous function, but in actuality it returns a Promise.
    /// Awaiting the function without converting it to a promise yields a redundant usage tooltip.
    const searchYouTube = async (query: string) => await (
      (this.searcher.search(query) as unknown) as Promise<YTSearch>
    );

    const search = await searchYouTube(message.content);
    
    if (search.currentPage === undefined) {
      Client.warn(message.channel, 'No videos found matching your search.');
      return;
    }

    const searchResults = Array.from(Utils.decodeVideoTitles(search.currentPage));
    
    const video = await Module.browse(
      message, searchResults, (videoEntry) => videoEntry.title
    );

    return video?.url;
  }

  /// Plays the requested song or the next song in queue
  async play(textChannel: TextChannel, listing?: Listing, announce: boolean = true) {
    if (listing !== undefined) {
      this.module.queue.push(listing);

      // If the user requested a song while a song was already playing
      if (this.module.isPlaying) {
        Client.info(textChannel, `Added '${listing.title}' to the queue. [#${this.module.queue.length}]`);
        return;
      }
    }

    // Register the current song in the history of songs played, ensuring
    // that it is only added to history if the last song played wasn't the
    // same as the current song
    if (this.module.isPlaying) {
      this.module.history.push(this.module.currentListing!);
    }

    // If there are no more songs to play, remove the current song
    // and stop the dispatcher
    if (this.module.queue.length === 0) {
      this.module.currentSong = undefined;
      this.module.currentListing = undefined;
      this.module.voiceConnection?.dispatcher?.end();
      return;
    }

    this.module.currentListing = this.module.queue.shift();
    this.module.currentSong = this.module.currentListing!.currentSong;

    const streamOptions: StreamOptions = {
      seek: this.module.currentSong!.offset,
      volume: this.module.volume,
    };
    const stream = ytdl(this.module.currentSong!.url, {
      quality: 'highestaudio',
      filter: 'audioonly',
    });

    this.module.voiceConnection!.play(stream, streamOptions)
      .on('finish', () => this.play(textChannel))
      .on('error', (error) => {
        console.error(error);
        this.play(textChannel);
      });

    if (announce) {
      Client.info(textChannel, `Now playing '${this.module.currentSong!.title}'...`);
    }
  }
}