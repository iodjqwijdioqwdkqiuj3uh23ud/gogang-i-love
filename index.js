const { Client, GatewayIntentBits, PermissionsBitField, REST, Routes, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, WebhookClient } = require('discord.js');
const { OpenAI } = require('openai');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./bot.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS knowledge (q TEXT, a TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS warnings (userId TEXT, reason TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS blacklist (userId TEXT)");
});

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

client.on('interactionCreate', async interaction => {
    // 1. 가르치기 (모달)
    if (interaction.commandName === '가르치기') {
        const modal = new ModalBuilder().setCustomId('teachModal').setTitle('봇 가르치기');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q').setLabel('질문').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('a').setLabel('대답').setStyle(TextInputStyle.Paragraph).setRequired(true))
        );
        return interaction.showModal(modal);
    }
    if (interaction.isModalSubmit() && interaction.customId === 'teachModal') {
        const q = interaction.fields.getTextInputValue('q');
        const a = interaction.fields.getTextInputValue('a');
        db.run("INSERT INTO knowledge VALUES (?, ?)", [q, a]);
        return interaction.reply(`학습 완료: "${q}" -> "${a}"`);
    }

    // 2. 티켓패널
    if (interaction.commandName === '티켓패널') {
        const embed = new EmbedBuilder().setTitle('문의하기').setDescription('아래 버튼을 눌러 티켓을 생성하세요.');
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('create_ticket').setLabel('티켓 생성').setStyle(ButtonStyle.Primary));
        return interaction.reply({ embeds: [embed], components: [btn] });
    }
    if (interaction.isButton() && interaction.customId === 'create_ticket') {
        const ch = await interaction.guild.channels.create({ name: `ticket-${interaction.user.username}` });
        return interaction.reply({ content: `티켓이 생성되었습니다: ${ch}`, ephemeral: true });
    }

    // 3. 경고
    if (interaction.commandName === '경고') {
        const member = interaction.options.getMember('유저');
        const reason = interaction.options.getString('사유');
        db.run("INSERT INTO warnings VALUES (?, ?)", [member.id, reason]);
        return interaction.reply(`${member.user.tag}님에게 경고했습니다: ${reason}`);
    }

    // 4. 핑
    if (interaction.commandName === '핑') {
        const embed = new EmbedBuilder().setTitle('서버 상태').addFields({ name: '응답 속도', value: `${client.ws.ping}ms` }).setColor(0x00FF00);
        return interaction.reply({ embeds: [embed] });
    }

    // 5. 블랙리스트
    if (interaction.commandName === '블랙리스트') {
        const user = interaction.options.getUser('유저');
        db.run("INSERT INTO blacklist VALUES (?)", [user.id]);
        return interaction.reply(`${user.tag}님이 블랙리스트에 등록되었습니다.`);
    }

    // 6. 웹훅보내기 (모달)
    if (interaction.commandName === '웹훅보내기') {
        const modal = new ModalBuilder().setCustomId('webhookModal').setTitle('웹훅 전송');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('url').setLabel('웹훅 URL').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('msg').setLabel('메시지').setStyle(TextInputStyle.Paragraph).setRequired(true))
        );
        return interaction.showModal(modal);
    }
    if (interaction.isModalSubmit() && interaction.customId === 'webhookModal') {
        const url = interaction.fields.getTextInputValue('url');
        const msg = interaction.fields.getTextInputValue('msg');
        new WebhookClient({ url: url }).send({ content: msg });
        return interaction.reply({ content: '전송됨', ephemeral: true });
    }
});

// 채팅 응답 및 명령어
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (message.content === '고강아 핑') return message.reply(`${client.ws.ping}ms`);
    if (message.content === '고강아 블랙리스트') {
        db.all("SELECT userId FROM blacklist", [], (err, rows) => {
            const list = rows.map(r => `<@${r.userId}>`).join(', ');
            message.reply({ embeds: [new EmbedBuilder().setTitle('블랙리스트').setDescription(list || '없음')] });
        });
    }
    if (message.content.startsWith('고강아 ')) {
        const query = message.content.replace('고강아 ', '').trim();
        db.get("SELECT a FROM knowledge WHERE q = ?", [query], (err, row) => {
            message.reply(row ? row.a : '모르는 내용이야');
        });
    }
});

client.once('ready', async () => {
    const commands = [
        new SlashCommandBuilder().setName('가르치기').setDescription('학습'),
        new SlashCommandBuilder().setName('티켓패널').setDescription('티켓 생성'),
        new SlashCommandBuilder().setName('경고').setDescription('경고').addUserOption(o=>o.setName('유저').setRequired(true)).addStringOption(o=>o.setName('사유').setRequired(true)),
        new SlashCommandBuilder().setName('핑').setDescription('서버 핑 확인'),
        new SlashCommandBuilder().setName('블랙리스트').setDescription('블랙리스트 등록').addUserOption(o=>o.setName('유저').setRequired(true)),
        new SlashCommandBuilder().setName('웹훅보내기').setDescription('웹훅 전송')
    ].map(c => c.toJSON());
    await new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN).put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('완벽 통합 완료!');
});

client.login(process.env.DISCORD_TOKEN);
