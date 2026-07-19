const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, WebhookClient } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./bot.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS knowledge (q TEXT, a TEXT, teacher TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS warnings (userId TEXT, reason TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS blacklist (userId TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS settings (guildId TEXT PRIMARY KEY, logChannelId TEXT)");
});

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() && !interaction.isModalSubmit() && !interaction.isButton()) return;

    // 명령어 모음
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
        db.get("SELECT a FROM knowledge WHERE q = ?", [q], (err, row) => {
            if (row) return interaction.reply({ content: '이미 있음~ 병신아', ephemeral: true });
            db.run("INSERT INTO knowledge (q, a, teacher) VALUES (?, ?, ?)", [q, a, interaction.user.username]);
            db.get("SELECT logChannelId FROM settings WHERE guildId = ?", [interaction.guild.id], (err, setting) => {
                if (setting) {
                    const logChannel = interaction.guild.channels.cache.get(setting.logChannelId);
                    if (logChannel) logChannel.send(`[학습 로그] ${interaction.user.tag}님이 가르침!\n질문: ${q}\n대답: ${a}`);
                }
            });
            return interaction.reply(`학습 완료: "${q}" -> "${a}"`);
        });
    }

    if (interaction.commandName === '가르치기로그') {
        db.run("INSERT OR REPLACE INTO settings (guildId, logChannelId) VALUES (?, ?)", [interaction.guild.id, interaction.options.getChannel('채널').id]);
        return interaction.reply('로그 채널 설정 완료!');
    }
    if (interaction.commandName === '티켓패널') {
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('create_ticket').setLabel('티켓 생성').setStyle(ButtonStyle.Primary));
        return interaction.reply({ content: '문의하기', components: [btn] });
    }
    if (interaction.isButton() && interaction.customId === 'create_ticket') {
        const ch = await interaction.guild.channels.create({ name: `ticket-${interaction.user.username}` });
        return interaction.reply({ content: `생성됨: ${ch}`, ephemeral: true });
    }
    if (interaction.commandName === '경고') {
        db.run("INSERT INTO warnings VALUES (?, ?)", [interaction.options.getMember('유저').id, interaction.options.getString('사유')]);
        return interaction.reply('경고 완료.');
    }
    if (interaction.commandName === '핑') return interaction.reply(`${client.ws.ping}ms`);
    if (interaction.commandName === '블랙리스트') {
        db.run("INSERT INTO blacklist VALUES (?)", [interaction.options.getUser('유저').id]);
        return interaction.reply('블랙리스트 등록.');
    }
    if (interaction.commandName === '웹훅보내기') {
        const modal = new ModalBuilder().setCustomId('wModal').setTitle('웹훅').addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('url').setLabel('URL').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('msg').setLabel('메시지').setStyle(TextInputStyle.Paragraph).setRequired(true))
        );
        return interaction.showModal(modal);
    }
    if (interaction.isModalSubmit() && interaction.customId === 'wModal') {
        new WebhookClient({ url: interaction.fields.getTextInputValue('url') }).send({ content: interaction.fields.getTextInputValue('msg') });
        return interaction.reply({ content: '전송완료', ephemeral: true });
    }
    if (interaction.commandName === '역할지급') {
        await interaction.options.getMember('유저').roles.add(interaction.options.getRole('역할'));
        return interaction.reply('지급 완료.');
    }
    if (interaction.commandName === '채널생성') {
        const ch = await interaction.guild.channels.create({ name: interaction.options.getString('채널명'), parent: interaction.options.getChannel('카테고리').id });
        return interaction.reply(`${ch} 생성 완료.`);
    }
    if (interaction.commandName === '역할생성') {
        const r = await interaction.guild.roles.create({ name: interaction.options.getString('역할이름') });
        return interaction.reply(`${r.name} 생성 완료.`);
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    const args = message.content.split(' ');
    const member = message.mentions.members.first();

    if (message.content.startsWith('고강아 ') && member) {
        if (args[2] === '추방') {
            if (!member.kickable) return message.reply('권한이 낮아요!');
            await member.kick();
            return message.reply('추방 완료.');
        }
        if (args[2] === '차단') {
            if (!member.bannable) return message.reply('권한이 낮아요!');
            await member.ban();
            return message.reply('차단 완료.');
        }
    }
    if (message.content === '고강아 안녕') return message.reply('안녕! 난 고강이라고해. 기본적으로 xAI사용하고 있어.');
    if (message.content.startsWith('고강아 ') && !message.content.includes(' 추방') && !message.content.includes(' 차단')) {
        const query = message.content.replace('고강아 ', '').trim();
        db.get("SELECT a, teacher FROM knowledge WHERE q = ?", [query], (err, row) => {
            message.reply(row ? `${row.a}\n(가르친 사람: ${row.teacher})` : '왓더뻑🤯');
        });
    }
});

client.once('ready', async () => {
    const commands = [
        new SlashCommandBuilder().setName('가르치기').setDescription('질문 학습'),
        new SlashCommandBuilder().setName('가르치기로그').setDescription('로그 설정').addChannelOption(o => o.setName('채널').setRequired(true)),
        new SlashCommandBuilder().setName('티켓패널').setDescription('티켓 생성'),
        new SlashCommandBuilder().setName('경고').setDescription('경고').addUserOption(o => o.setName('유저').setRequired(true)).addStringOption(o => o.setName('사유').setRequired(true)),
        new SlashCommandBuilder().setName('핑').setDescription('핑 확인'),
        new SlashCommandBuilder().setName('블랙리스트').setDescription('블랙리스트').addUserOption(o => o.setName('유저').setRequired(true)),
        new SlashCommandBuilder().setName('웹훅보내기').setDescription('웹훅'),
        new SlashCommandBuilder().setName('역할지급').setDescription('역할지급').addUserOption(o=>o.setName('유저').setRequired(true)).addRoleOption(o=>o.setName('역할').setRequired(true)),
        new SlashCommandBuilder().setName('채널생성').setDescription('채널생성').addChannelOption(o=>o.setName('카테고리').setRequired(true)).addStringOption(o=>o.setName('채널명').setRequired(true)),
        new SlashCommandBuilder().setName('역할생성').setDescription('역할생성').addStringOption(o=>o.setName('역할이름').setRequired(true))
    ].map(c => c.toJSON());
    await new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN).put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('최종 통합 완료!');
});

client.login(process.env.DISCORD_TOKEN);
client.login(process.env.DISCORD_TOKEN);
