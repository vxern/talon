import { EmbedField, GuildMember, Role } from 'discord.js';

import { LunaModule } from './module';
import { LunaClient } from '../client/client';
import { Embed } from '../client/embed';

import { Language } from '../language';

import roles from '../roles.json';

// Concatenate the roles specified in [roles.json] into a single array
const allRoles = [
  ...roles.proficiency,
  ...roles.regions,
  ...roles.ethnicities,
  ...roles.abroad,
  ...roles.miscellaneous,
];

export class RolesModule extends LunaModule {
  readonly commandTree = {
    'roles ~ Display a list of available roles': () => this.displayRoles(),
    '$rolename ~ Assign the role with the name <rolename> to yourself': (roleName: string) => this.resolveRole(roleName),
  };

  displayRoles() {
    const roleCategoriesToDisplay = Object.entries(roles).slice(2, this.hasProficiency() ? undefined : 2);
    const fields = roleCategoriesToDisplay.map<EmbedField>(([key, value]) => {return {
      name: Language.capitaliseWords(key),
      value: (value as string[]).map((roleName) => this.toTag(this.findRole(roleName).id)).join(' '),
      inline: true,
    }});

    LunaClient.info(this.args['textChannel'], new Embed({fields: fields}));
  }

  resolveRole(roleName: string) {
    roleName = roleName.toLowerCase();

    // If the sought role is not found in [allRoles]
    if (!allRoles.includes(roleName)) {
      return;
    }

    // If the sought role is not a proficiency role
    if (!roles.proficiency.includes(roleName)) {
      return this.resolveNonProficiencyRole(roleName);
    }

    if (!this.hasRole(roleName)) {
      const currentProficiencyRole = this.getCurrentProficiencyRole();
      return this.addOrReplaceProficiencyRole(roleName, currentProficiencyRole);
    }

    let message = `Your level is already ${this.toTag(this.findRole(roleName).id)}.\n\nInstead, you may `;
    let upgradeMessage = ':arrow_double_up: upgrade to ';
    let downgradeMessage = ':arrow_double_down: downgrade to ';

    const indexOfProficiencyRole = roles.proficiency.indexOf(roleName);

    const roleTagsToUpgradeTo: string[] = this.getTagsOfProficiencyRolesBetterThan(indexOfProficiencyRole);
    const roleTagsToDowngradeTo: string[] = this.getTagsOfProficiencyRolesWorseThan(indexOfProficiencyRole);

    if (roleTagsToUpgradeTo.length !== 0) {
      upgradeMessage += Language.join(roleTagsToUpgradeTo, 'or');
      message += upgradeMessage;

      if (roleTagsToDowngradeTo.length !== 0) {
        message += ' or ';
      }
    }

    if (roleTagsToDowngradeTo.length !== 0) {
      downgradeMessage += Language.join(roleTagsToDowngradeTo, 'or');
      message += downgradeMessage;
    }

    LunaClient.info(this.args['textChannel'], new Embed({message: message}));
  }

  resolveNonProficiencyRole(roleName: string) {
    // If the user does not have a proficiency role yet
    if (!this.hasProficiency()) {
      return;
    }

    // If the user already has the sought role
    if (this.hasRole(roleName)) {
      return this.removeRole(roleName);
    }

    return this.addRole(roleName);
  }

  addRole(roleName: string) {
    const member: GuildMember = this.args['member'];
    member.roles.add(this.findRole(roleName));

    const capitalisedRoleName = Language.capitaliseWords(roleName);

    let message = `You now have the role '${capitalisedRoleName}'`;

    if (roles.ethnicities.includes(roleName)) {
      if (this.hasEnoughEthnicityRoles()) {
        LunaClient.warn(this.args['textChannel'], new Embed({
          message: `You may not be of more than ${roles.maximumEthnicityRoles} Romanian ethnicities at any given time`,
        }));
        return;
      }

      message = `You are now ${capitalisedRoleName}`;
    }

    if (roles.regions.includes(roleName)) {
      if (this.hasEnoughRegionRoles()) {
        LunaClient.warn(this.args['textChannel'], new Embed({
          message: `You may not have more than ${roles.maximumRegionRoles} region roles at any given time`,
        }));
        return;
      }

      message = `You are now from ${capitalisedRoleName}`;
    }

    if (roles.abroad.includes(roleName)) {
      message = `You are now a ${roleName}`;
    }

    LunaClient.info(this.args['textChannel'], new Embed({message: message + ` :partying_face:`}));
  }

  removeRole(roleName: string) {
    const member: GuildMember = this.args['member'];
    member.roles.remove(this.findRole(roleName));

    const capitalisedRoleName = Language.capitaliseWords(roleName);

    let message = `You no longer have the role '${capitalisedRoleName}'`;

    if (roles.regions.includes(roleName)) {
      message = `You are no longer from ${capitalisedRoleName}`;
    }

    if (roles.ethnicities.includes(roleName)) {
      message = `You are no longer ${capitalisedRoleName}`;
    }

    if (roles.abroad.includes(roleName)) {
      message = `You are no longer a ${capitalisedRoleName}`;
    }

    LunaClient.info(this.args['textChannel'], new Embed({message: message + ` :sob:`}));
  }

  addOrReplaceProficiencyRole(roleName: string, currentProficiencyRole: Role | undefined) {
    const member: GuildMember = this.args['member'];
    member.roles.add(this.findRole(roleName));

    if (currentProficiencyRole !== undefined) {
      this.removeProficiencyRole(currentProficiencyRole);
    }

    LunaClient.info(this.args['textChannel'], new Embed({message: `Your level is now ${roleName}`}));
  }

  removeProficiencyRole(proficiencyRole: Role) {
    const member: GuildMember = this.args['member'];
    member.roles.remove(proficiencyRole);
  }

  findRole(roleName: string): Role {
    const member: GuildMember = this.args['member'];
    return member.guild.roles.cache.find((role) => role.name.toLowerCase() === roleName)!;
  }

  hasRole(roleName: string): boolean {
    const member: GuildMember = this.args['member'];
    return member.roles.cache.some((role) => role.name.toLowerCase() === roleName);
  }

  hasProficiency(): boolean {
    const member: GuildMember = this.args['member'];
    return member.roles.cache.some((role) => roles.proficiency.includes(role.name.toLowerCase()))
  }

  getCurrentProficiencyRole(): Role | undefined {
    const member: GuildMember = this.args['member'];
    return member.roles.cache.find((role) => roles.proficiency.includes(role.name.toLowerCase()));
  }

  getTagsOfProficiencyRolesBetterThan(roleIndex: number): string[] {
    return roles.proficiency.filter((_, index) => index > roleIndex).map((roleName) => this.toTag(this.findRole(roleName).id));
  }

  getTagsOfProficiencyRolesWorseThan(roleIndex: number): string[] {
    return roles.proficiency.filter((_, index) => index < roleIndex).map((roleName) => this.toTag(this.findRole(roleName).id));
  }

  toTag(id: string): string {
    return `<@&${id}>`;
  }

  hasEnoughEthnicityRoles(): boolean {
    const member: GuildMember = this.args['member'];
    return member.roles.cache.filter(
      (role) => roles.regions.includes(role.name.toLowerCase())
    ).size >= roles.maximumEthnicityRoles;
  }

  hasEnoughRegionRoles(): boolean {
    const member: GuildMember = this.args['member'];
    return member.roles.cache.filter(
      (role) => roles.regions.includes(role.name.toLowerCase())
    ).size >= roles.maximumRegionRoles;
  }
}