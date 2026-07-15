const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const IMAGES = [
  'https://upload.wikimedia.org/wikipedia/commons/2/28/Patrick_Star_character.png',
  'https://upload.wikimedia.org/wikipedia/en/3/33/Patrick_Star.svg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Patrick_Star.svg/480px-Patrick_Star.svg.png',
  'https://upload.wikimedia.org/wikipedia/en/thumb/3/33/Patrick_Star.svg/240px-Patrick_Star.svg.png',
];

module.exports = {
  category: '娛樂',
  data: new SlashCommandBuilder()
    .setName('patrick')
    .setDescription('派大星！'),
  async execute(interaction) {
    const img = IMAGES[Math.floor(Math.random() * IMAGES.length)];
    const embed = new EmbedBuilder()
      .setColor(0xf472b6)
      .setTitle('⭐ 派大星！')
      .setImage(img);
    await interaction.reply({ embeds: [embed] });
  },
};
