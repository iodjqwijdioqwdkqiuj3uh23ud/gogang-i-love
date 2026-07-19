const { Client, GatewayIntentBits, PermissionsBitField, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { OpenAI } = require('AQ.Ab8RN6J9-M3Py7CJg7qgjPSfFB5vTHi-3tlPxteC6tPk7u454Q');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (message.content.startsWith('고강아 ')) {
        const content = message.content.slice(4).trim();
        if (content.includes('추방해줘') && message.mentions.members.first()) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return message.reply('추방 권한이 없습니다.');
            try {
                await message.mentions.members.first().kick();
                message.reply('추방 완료.');
            } catch { message.reply('추방 불가.'); }
            return;
        }
        try {
            const res = await openai.chat.completions.create({ messages: [{ role: 'user', content }], model: 'gpt-3.5-turbo' });
            message.reply(res.choices[0].message.content || '왓더 뻑;;🤯');
        } catch { message.reply('왓더 뻑;;🤯'); }
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    if (interaction.commandName === '템플릿로드') {
        const id = interaction.options.getString('url').split('/').pop();
        try {
            const t = await client.fetchGuildTemplate(id);
            await interaction.guild.roles.set(t.serializedSourceGuild.roles);
            await interaction.guild.channels.set(t.serializedSourceGuild.channels);
            interaction.reply('적용 완료.');
        } catch { interaction.reply('실패.'); }
    }
    if (interaction.commandName === '티켓생성') {
        const ch = await interaction.guild.channels.create({ name: `ticket-${interaction.user.username}`, permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }] });
        interaction.reply(`생성됨: ${ch}`);
    }
});

client.once('ready', async () => {
    const commands = [
        new SlashCommandBuilder().setName('템플릿로드').setDescription('로드').addStringOption(o => o.setName('url').setRequired(true)),
        new SlashCommandBuilder().setName('티켓생성').setDescription('생성')
    ];
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
});

client.login(process.env.DISCORD_TOKEN);