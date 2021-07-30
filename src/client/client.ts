import { Client as DiscordClient, TextChannel, Message } from 'discord.js';

import { LunaModule as LunaModule } from '../modules/module';
import { MusicModule } from '../modules/music/music';
import { RolesModule } from '../modules/roles';

import { cyclePresence } from '../services/presence';
import { Embed } from './embed';
import { Language } from '../language';

import config from '../config.json';

export class LunaClient {
  private modules!: LunaModule[];
  private client: DiscordClient;

  constructor() {
    this.client = new DiscordClient();
    
    this.client.on('ready', () => this.initialize());
  }

  private initialize() {
    cyclePresence(this.client.user!);

    this.client.on('message', (message) => this.handleMessage(message));

    this.modules = [
      new MusicModule(),
      new RolesModule(),
    ];

    console.info(`${Language.capitaliseWords(config.alias)} is ready to serve with ${this.modules.length} modules.`);
  }

  async login() {
    await this.client.login(process.env.DISCORD_SECRET);
  }

  private handleMessage(message: Message) {
    // If the message was submitted by a bot
    if (message.author.bot) {
      return;
    }

    // If the message was submitted by itself
    if (message.member!.id === this.client.user!.id) {
      return;
    }

    message.channel = message.channel as TextChannel;

    // If the message was submitted in an excluded channel
    if (Language.removeNonAlphanumeric(message.channel.name) in config.excludedChannels) {
      return;
    }

    // Transform the message content into a digestible format
    let messageTrimmed: string = Language.normaliseSpaces(message.content);

    const inAliaslessChannel = config.aliaslessChannels.includes(message.channel.name)

    // If the message doesn't begin with the specified alias
    if (!messageTrimmed.toLowerCase().startsWith(config.alias) && !inAliaslessChannel) {
      return;
    } 

    // Remove the prefix to leave just the parsable content
    const args = messageTrimmed.split(' ');
    if (!inAliaslessChannel) {
      args.shift();
      message.content = args.join(' ');
    } else {
      message.content = messageTrimmed;
    }

    if (message.content.length === 0) {
      LunaClient.info(message.channel, new Embed({
        message: 'No command was provided',
      }));
      return;
    }
  
    this.resolveMessageToCommand(message);
  }

  private resolveMessageToCommand(message: Message) {
    const args = message.content.split(' ');
    const foremostCommand = args[0];

    const branchIsMatch = ([commandsWithTooltip, _]: [string, any]) => {
      const commands = commandsWithTooltip
        .split('~')[0]
        .trimRight()
        .split('|')
        .map((command) => command.trim());
      return commands[0].startsWith('$') || 
        commands.includes(foremostCommand) ||
        // A command can consist of two words, therefore it's necessary to check the whole content too 
        commands.includes(message.content)
    };

    // Find branches with a key corresponding to the foremost argument, with the [requirement]
    // yielding true and concatenate them into a single array
    const matchedBranches = ([] as [string, any][]).concat(...this.modules
      // Get modules with a command tree whose branch' command matches the message
      .filter((module) => Object.entries(module.commandTree).some(branchIsMatch))
      // Ensure that the module's [requirement] is met, otherwise exclude its [commandTree]
      .filter((module) => {
        let requirementMet: boolean;

        module.args = {
          'textChannel': message.channel as TextChannel,
          'voiceChannel': message.member?.voice.channel,
          'member': message.member,
          'bot': this.client.user,
          'message': message,
        }

        if (typeof module.requirement === 'boolean') {
          requirementMet = module.requirement;
        } else {
          requirementMet = module.requirement();  
        }

        if (requirementMet) {
          module.beforeExecutingCommand();
        }

        return requirementMet;
      })
      // Find branches whose commands match the message
      .map((module) => Object.entries(module.commandTree).filter(branchIsMatch))
    );

    message.channel = message.channel as TextChannel;

    // If branches have been found corresponding to the command
    if (matchedBranches.length === 0) {
      LunaClient.warn(message.channel, new Embed({
        message: 'Unknown command',
      }));
      return;
    }

    const [command, callback] = matchedBranches[0];

    if (!command.split(' ')[0].startsWith('$')) {
      args.shift();
    }
    message.content = args.join(' ');
    
    callback(message.content);
  }

  private static async sendEmbed(textChannel: TextChannel, embed: Embed): Promise<Message> {
    return textChannel.send({embed: {
      title: embed.title,
      thumbnail: {url: embed.thumbnail},
      description: embed.message,
      color: embed.color,
      fields: embed.fields,
    }})
  }

  static async tip(textChannel: TextChannel, embed: Embed): Promise<Message> {
    if (embed.message !== undefined) {
      embed.message = `:information_source: ` + embed.message;
    }
    embed.color = config.accentColorTip;
    return this.sendEmbed(textChannel, embed);
  }

  static async info(textChannel: TextChannel, embed: Embed): Promise<Message> {
    return this.sendEmbed(textChannel, embed);
  }

  static async warn(textChannel: TextChannel, embed: Embed): Promise<Message> {
    if (embed.message !== undefined) {
      embed.message = `:warning: ` + embed.message;
    }
    embed.color = config.accentColorWarning;
    return this.sendEmbed(textChannel, embed);
  }

  static async error(textChannel: TextChannel, embed: Embed): Promise<Message> {
    if (embed.message !== undefined) {
      embed.message = `:exclamation: ` + embed.message;
    }
    embed.color = config.accentColorError;
    return this.sendEmbed(textChannel, embed);
  }
}