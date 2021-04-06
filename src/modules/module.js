import { areSimilar } from "../language.js";
import { filterObject } from "../utils.js";

export class TeacherModule {
    /// Takes a `message` and `commands`
    /// 
    /// If the first argument matches a command's `trigger`, call or resolve its `result`
    async resolveCommand(message, commands) {
        let words = message.split(' ');
        // Obtain the first argument so it can be resolved
        let firstArgument = words.shift();
        // The message passed to the result should not contain the argument that will be resolved now
        let passedMessage = words.join(' ');

        if (firstArgument === undefined) {
            return false;
        }

        // Remove commands that do not have a similar trigger
        commands = filterObject(commands, (trigger) => areSimilar(trigger, firstArgument) || trigger.startsWith('$'));

        // Convert object to map
        commands = new Map(Object.entries(commands));
        
        // Do not continue if none of the commands matched one of the identifiers
        if (commands.size === 0) {
            return false;
        }

        // Get the first command
        let identifiedResult = commands.values().next().value;

        // If `identifiedResult` is not an object, call it
        if (typeof identifiedResult !== 'object') {
            // If the following term is not expected to be an argument
            if (firstArgument === '') {
                return await identifiedResult() || true;
            }

            return await identifiedResult(firstArgument) || true;
        }

        // If the following term is empty, and a command for an empty term is not specified
        if (passedMessage === '' && !Object.keys(identifiedResult).includes('')) {
            return;
        }

        // Otherwise, if `identifiedResult` is not a function, resolve it
        return await this.resolveCommand(passedMessage, identifiedResult);
    }
}