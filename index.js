require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType, Events } = require('discord.js');
const {
  joinVoiceChannel,
  getVoiceConnection,
  entersState,
  VoiceConnectionStatus,
} = require('@discordjs/voice');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const PREFIX = process.env.PREFIX || '!';
const TOKEN = process.env.TOKEN || '';
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID || '';
const STATUS_TEXT = process.env.STATUS_TEXT || 'Sunucunda 24 saat aktif';

if (!TOKEN) {
  console.error('HATA: TOKEN boş. .env dosyasına bot tokenini yaz.');
  process.exit(1);
}

let targetVoiceId = VOICE_CHANNEL_ID;

async function connectToVoiceChannel(voiceChannel) {
  try {
    const oldConnection = getVoiceConnection(voiceChannel.guild.id);
    if (oldConnection) {
      try {
        oldConnection.destroy();
      } catch (_) {}
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 30000);
      console.log(`Ses kanalına bağlandı: ${voiceChannel.name}`);
    } catch (error) {
      console.error('Ses bağlantısı hazır olmadı, tekrar denenecek...');
      try {
        connection.destroy();
      } catch (_) {}
      setTimeout(() => tryReconnect(voiceChannel.guild), 5000);
      return;
    }

    connection.on('stateChange', async (_, newState) => {
      if (newState.status === VoiceConnectionStatus.Disconnected) {
        console.log('Bağlantı koptu, yeniden bağlanılıyor...');
        setTimeout(() => tryReconnect(voiceChannel.guild), 5000);
      }
    });
  } catch (error) {
    console.error('Ses kanalına bağlanırken hata:', error.message);
  }
}

async function tryReconnect(guild) {
  if (!targetVoiceId) return;

  try {
    const channel = await guild.channels.fetch(targetVoiceId);
    if (channel && channel.isVoiceBased()) {
      await connectToVoiceChannel(channel);
    } else {
      console.log('VOICE_CHANNEL_ID bulundu ama bu bir ses kanalı değil.');
    }
  } catch (error) {
    console.error('Yeniden bağlanma başarısız, tekrar denenecek...');
    setTimeout(() => tryReconnect(guild), 10000);
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`Bot aktif: ${client.user.tag}`);

  client.user.setPresence({
    activities: [{ name: STATUS_TEXT, type: ActivityType.Custom }],
    status: 'online',
  });

  if (targetVoiceId) {
    try {
      const channel = await client.channels.fetch(targetVoiceId);
      if (channel && channel.isVoiceBased()) {
        await connectToVoiceChannel(channel);
      } else {
        console.log('VOICE_CHANNEL_ID bulundu ama bu bir ses kanalı değil.');
      }
    } catch (error) {
      console.error('İlk açılışta ses kanalına bağlanılamadı:', error.message);
    }
  } else {
    console.log('VOICE_CHANNEL_ID boş. İstersen !gel komutuyla bulunduğun ses kanalına çağır.');
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = (args.shift() || '').toLowerCase();

  if (command === 'ping') {
    return message.reply('Pong! Bot çalışıyor.');
  }

  if (command === 'gel') {
    const userVoiceChannel = message.member?.voice?.channel;
    if (!userVoiceChannel) {
      return message.reply('Önce bir ses kanalına gir, sonra tekrar yaz.');
    }

    targetVoiceId = userVoiceChannel.id;
    await connectToVoiceChannel(userVoiceChannel);
    return message.reply(`Yanına geldim: **${userVoiceChannel.name}**`);
  }

  if (command === 'çık' || command === 'cik') {
    const connection = getVoiceConnection(message.guild.id);
    if (!connection) {
      return message.reply('Zaten bir ses kanalında değilim.');
    }

    targetVoiceId = '';
    connection.destroy();
    return message.reply('Ses kanalından çıktım.');
  }

  if (command === 'help') {
    return message.reply('Komutlar: !ping | !gel | !çık');
  }
});

client.login(TOKEN);
