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

client.on('interactionCreate', async interaction => {
  
    if (interaction.commandName === '핑') {
        const embed = new EmbedBuilder()
            .setTitle('서버 정보 및 속도')
            .addFields(
                { name: '응답 속도', value: `${client.ws.ping}ms`, inline: true },
                { name: '서버 이름', value: interaction.guild.name, inline: true },
                { name: '멤버 수', value: `${interaction.guild.memberCount}명`, inline: true }
            ).setColor(0x00FF00);
        return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === '블랙리스트') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return interaction.reply('권한 부족');
        const user = interaction.options.getUser('유저');
        db.run("INSERT INTO blacklist VALUES (?)", [user.id]);
        await interaction.guild.members.ban(user, { reason: '블랙리스트 등록' });
        return interaction.reply(`${user.tag}님이 블랙리스트에 등록되고 차단되었습니다.`);
    }

    if (interaction.commandName === '웹훅보내기') {
        const modal = new ModalBuilder().setCustomId('webhookModal').setTitle('웹훅 메시지 전송');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('url').setLabel('웹훅 URL').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('msg').setLabel('메시지 내용').setStyle(TextInputStyle.Paragraph).setRequired(true))
        );
        return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'webhookModal') {
        const url = interaction.fields.getTextInputValue('url');
        const msg = interaction.fields.getTextInputValue('msg');
        const webhookClient = new WebhookClient({ url: url });
        await webhookClient.send({ content: msg });
        return interaction.reply({ content: '웹훅 메시지 전송 완료!', ephemeral: true });
    }

    if (interaction.commandName === '가르치기') { /* 생략 */ }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    
    if (message.content === '고강아 핑') return message.reply(`현재 핑: ${client.ws.ping}ms`);
    
    if (message.content === '고강아 블랙리스트') {
        db.all("SELECT userId FROM blacklist", [], (err, rows) => {
            const list = rows.map(r => `<@${r.userId}>`).join(', ');
            const embed = new EmbedBuilder().setTitle('블랙리스트 목록').setDescription(list || '없음');
            message.reply({ embeds: [embed] });
        });
    }

    if (message.content.startsWith('고강아 ')) { /* 기존 지식 답변 */ }
});

client.once('ready', async () => {
    const commands = [
        new SlashCommandBuilder().setName('핑').setDescription('서버 상태를 확인합니다.'),
        new SlashCommandBuilder().setName('블랙리스트').setDescription('유저를 영구 차단합니다.')
            .addUserOption(o => o.setName('유저').setDescription('대상').setRequired(true)),
        new SlashCommandBuilder().setName('웹훅보내기').setDescription('웹훅으로 메시지를 보냅니다.'),
       
    ].map(c => c.toJSON());
 
    console.log('모든 관리 기능 활성화 완료!');
});

client.login(process.env.DISCORD_TOKEN);
