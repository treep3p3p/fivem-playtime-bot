// Import necessary modules and setup
const { Client, Intents, SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

// Define MongoDB schema for permissions and subscription
const permissionSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    canAddTime: { type: Boolean, default: false },
    canRemoveTime: { type: Boolean, default: false }
});

const subscriptionSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    startDate: { type: Date, default: Date.now },
    duration: { type: Number, default: 0 } // Duration in days
});

// Create models from schema
const Permission = mongoose.model('Permission', permissionSchema);
const Subscription = mongoose.model('Subscription', subscriptionSchema);

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('Failed to connect to MongoDB:', err);
});

const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

// Bot creator ID
const BOT_CREATOR_ID = process.env.BOT_CREATOR_ID;

// Error messages
const ERROR_MESSAGES = {
    unauthorized: 'You do not have permission to use this command.',
    commandNotFound: 'Command not found.',
    invalidParameters: 'Invalid parameters. Usage: /addtime [steam_hex] [play_time]',
    databaseError: 'An error occurred while accessing the database.',
    permissionDenied: 'Permission denied. Only the bot owner can use this command.',
    subscriptionExpired: 'Your subscription has expired. Please contact the bot owner to extend the subscription.',
    subscriptionNotFound: 'Subscription not found for this server.'
};

// Event handlers
client.once('ready', () => {
    console.log('Bot is ready');
});

client.on('guildCreate', async guild => {
    // Initialize subscription with zero days when bot joins a new server
    try {
        await Subscription.create({ guildId: guild.id });
        console.log(`Initialized subscription for guild ${guild.id}`);
    } catch (error) {
        console.error('Error initializing subscription:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options, user, guild } = interaction;

    // Fetch subscription for the guild
    let subscription;
    try {
        subscription = await Subscription.findOne({ guildId: guild.id });
        if (!subscription) {
            return interaction.reply({ content: ERROR_MESSAGES.subscriptionNotFound, ephemeral: true });
        }
    } catch (error) {
        console.error('Error fetching subscription:', error);
        return interaction.reply({ content: ERROR_MESSAGES.databaseError, ephemeral: true });
    }

    // Check subscription status
    const currentDate = new Date();
    const expiryDate = new Date(subscription.startDate);
    expiryDate.setDate(expiryDate.getDate() + subscription.duration);

    if (currentDate > expiryDate) {
        return interaction.reply({ content: ERROR_MESSAGES.subscriptionExpired, ephemeral: true });
    }

    // Handle commands
    if (commandName === 'grantaccess') {
        const userId = options.getString('user');
        const canAddTime = options.getBoolean('addtime');
        const canRemoveTime = options.getBoolean('removetime');

        // Save permission to the database
        try {
            await Permission.create({ guildId: guild.id, userId, canAddTime, canRemoveTime });
            return interaction.reply('Access granted successfully.');
        } catch (error) {
            console.error('Error granting access:', error);
            return interaction.reply('Failed to grant access.');
        }
    }

    if (commandName === 'revokeaccess') {
        const userId = options.getString('user');

        // Remove permission from the database
        try {
            await Permission.findOneAndDelete({ guildId: guild.id, userId });
            return interaction.reply('Access revoked successfully.');
        } catch (error) {
            console.error('Error revoking access:', error);
            return interaction.reply('Failed to revoke access.');
        }
    }

    if (commandName === 'addtime') {
        // Add play time command
        // Implementation remains the same
    }

    if (commandName === 'listtimes') {
        // List play times command
        // Implementation remains the same
    }

    if (commandName === 'extendtime') {
        // Extend subscription time (owner-only)
        if (user.id !== BOT_CREATOR_ID) {
            return interaction.reply({ content: ERROR_MESSAGES.permissionDenied, ephemeral: true });
        }
        const additionalDays = options.getInteger('days');
        try {
            subscription.duration += additionalDays;
            await subscription.save();
            return interaction.reply(`Subscription extended by ${additionalDays} days.`);
        } catch (error) {
            console.error('Error extending subscription:', error);
            return interaction.reply({ content: ERROR_MESSAGES.databaseError, ephemeral: true });
        }
    }

    if (commandName === 'checksubscription') {
        // Check remaining subscription time
        const remainingDays = Math.max(0, Math.ceil((expiryDate - currentDate) / (1000 * 60 * 60 * 24)));
        return interaction.reply(`Subscription has ${remainingDays} days remaining.`);
    }

    if (commandName === 'resetplaytime') {
        // Reset specified person's playtime command
        // Implementation goes here
    }

    if (commandName === 'resetallplaytimes') {
        // Reset all playtimes command
        // Implementation goes here
    }

    if (commandName === 'removeplaytime') {
        // Remove playtime from the list command
        // Implementation goes here
    }
});

// Function to check if user has permission to add/remove time
async function hasPermission(guildId, userId) {
    const permission = await Permission.findOne({ guildId, userId });
    return permission && (permission.canAddTime || permission.canRemoveTime);
}

// Slash commands setup
const commands = [
    new SlashCommandBuilder()
        .setName('addtime')
        .setDescription('Add play time for a Steam hex')
        .addStringOption(option => option.setName('steam_hex').setDescription('Steam hex ID').setRequired(true))
        .addIntegerOption(option => option.setName('play_time').setDescription('Play time in minutes').setRequired(true)),
    new SlashCommandBuilder()
        .setName('listtimes')
        .setDescription('List play times')
        .addIntegerOption(option => option.setName('page').setDescription('Page number')),
    new SlashCommandBuilder()
        .setName('extendtime')
        .setDescription('Extend subscription time (Owner only)')
        .addIntegerOption(option => option.setName('days').setDescription('Number of days to extend').setRequired(true)),
    new SlashCommandBuilder()
        .setName('grantaccess')
        .setDescription('Grant access to add/remove time')
        .addStringOption(option => option.setName('user').setDescription('User ID').setRequired(true))
        .addBooleanOption(option => option.setName('addtime').setDescription('Allow adding time').setRequired(true))
        .addBooleanOption(option => option.setName('removetime').setDescription('Allow removing time').setRequired(true)),
    new SlashCommandBuilder()
        .setName('revokeaccess')
        .setDescription('Revoke access to add/remove time')
        .addStringOption(option => option.setName('user').setDescription('User ID').setRequired(true)),
    new SlashCommandBuilder()
        .setName('checksubscription')
        .setDescription('Check remaining subscription days'),
    new SlashCommandBuilder()
        .setName('resetplaytime')
        .setDescription('Reset a person\'s playtime')
        .addStringOption(option => option.setName('user').setDescription('User ID').setRequired(true)),
    new SlashCommandBuilder()
        .setName('resetallplaytimes')
        .setDescription('Reset all playtimes'),
    new SlashCommandBuilder()
        .setName('removeplaytime')
        .setDescription('Remove playtime from the list')
        .addStringOption(option => option.setName('steam_hex').setDescription('Steam hex ID').setRequired(true))
].map(command => command.toJSON());

// Register slash commands globally
client.once('ready', async () => {
    try {
        await client.application.commands.set(commands);
        console.log('Slash commands registered');
    } catch (error) {
        console.error('Failed to register slash commands:', error);
    }
});

// Bot login
client.login(process.env.DISCORD_BOT_TOKEN);
