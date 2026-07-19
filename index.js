const { Client, GatewayIntentBits, PermissionsBitField, REST, Routes, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { OpenAI } = require('openai');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./bot.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS knowledge (q TEXT, a TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS warnings (userId TEXT, reason TEXT)");
});

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

client.on('interactionCreate', async interaction => {

    if (interaction.commandName === '가르치기') {
        const modal = new ModalBuilder().setCustomId('teachModal').setTitle('봇 가르치기');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q').setLabel('질문').setStyle(TextInputStyle.Short)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('a').setLabel('대답').setStyle(TextInputStyle.Paragraph))
        );
        return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'teachModal') {
        const q = interaction.fields.getTextInputValue('q');
        const a = interaction.fields.getTextInputValue('a');
        db.run("INSERT INTO knowledge VALUES (?, ?)", [q, a]);
        return interaction.reply(`학습 완료: "${q}" -> "${a}"`);
    }


    if (interaction.commandName === '티켓패널') {
        const embed = new EmbedBuilder().setTitle('문의하기').setDescription('아래 버튼을 눌러 티켓을 생성하세요.');
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('create_ticket').setLabel('티켓 생성').setStyle(ButtonStyle.Primary));
        return interaction.reply({ embeds: [embed], components: [btn] });
    }

    if (interaction.isButton() && interaction.customId === 'create_ticket') {
        const ch = await interaction.guild.channels.create({ name: `ticket-${interaction.user.username}` });
        return interaction.reply({ content: `티켓이 생성되었습니다: ${ch}`, ephemeral: true });
    }


    if (interaction.commandName === '경고') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return interaction.reply('권한 없음');
        const member = interaction.options.getMember('유저');
        const reason = interaction.options.getString('사유');
        db.run("INSERT INTO warnings VALUES (?, ?)", [member.id, reason]);
        return interaction.reply(`${member.user.tag}에게 경고함: ${reason}`);
    }
});


client.once('ready', async () => {
    const commands = [
        new SlashCommandBuilder().setName('가르치기').setDescription('질문과 대답을 가르칩니다.'),
        new SlashCommandBuilder().setName('티켓패널').setDescription('티켓 버튼을 생성합니다.'),
        new SlashCommandBuilder().setName('경고').setDescription('유저에게 경고를 줍니다.')
            .addUserOption(o => o.setName('유저').setRequired(true))
            .addStringOption(o => o.setName('사유').setRequired(true))
    ].map(c => c.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('관리 기능 포함 모든 설정 완료!');
});

client.login(process.env.DISCORD_TOKEN);

client.login(process.env.DISCORD_TOKEN);
