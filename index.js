const { Client, GatewayIntentBits, PermissionsBitField, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { OpenAI } = require('openai');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.startsWith('고강아 ')) {
        const content = message.content.slice(4).trim();

        if (content.includes('추방해줘') && message.mentions.members.first()) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
                return message.reply('추방 권한이 없습니다.');
            }
            const member = message.mentions.members.first();
            try {
                await member.kick();
                message.reply(`${member.user.tag}님을 추방했습니다.`);
            } catch {
                message.reply('추방할 수 없습니다.');
            }
            return;
        }

        try {
            const completion = await openai.chat.completions.create({
                messages: [{ role: 'user', content: content }],
                model: 'gpt-3.5-turbo',
            });
            message.reply(completion.choices[0].message.content || '왓더 뻑;;🤯');
        } catch {
            message.reply('왓더 뻑;;🤯');
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === '템플릿로드') {
        const url = options.getString('url');
        const templateId = url.split('/').pop();
        try {
            const template = await client.fetchGuildTemplate(templateId);
            await interaction.guild.roles.set(template.serializedSourceGuild.roles);
            await interaction.guild.channels.set(template.serializedSourceGuild.channels);
            interaction.reply('템플릿이 적용되었습니다.');
        } catch {
            interaction.reply('템플릿을 불러올 수 없습니다.');
        }
    }

    if (commandName === '티켓생성') {
        const channel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }
            ]
        });
        interaction.reply(`티켓이 생성되었습니다: ${channel}`);
    }
});

client.once('ready', async () => {
    const commands = [
        new SlashCommandBuilder()
            .setName('템플릿로드')
            .setDescription('서버 템플릿을 불러옵니다.')
            .addStringOption(o => o.setName('url').setDescription('템플릿 URL').setRequired(true)),
        new SlashCommandBuilder()
            .setName('티켓생성')
            .setDescription('문의 티켓 채널을 생성합니다.')
    ].map(c => c.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('준비 완료!');
});

client.login(process.env.DISCORD_TOKEN);
