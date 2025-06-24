const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const GEO_API_URL = 'http://api.openweathermap.org/geo/1.0/direct'; // API para obtener coordenadas por nombre de ciudad
const ONE_CALL_API_URL = 'https://api.openweathermap.org/data/2.5/onecall'; // API completa para tiempo y previsión

// Función para obtener la descripción del tiempo con un emoji apropiado
function getWeatherEmoji(iconCode) {
    if (!iconCode) return '☁️'; // Default if no icon code

    // Mapeo básico de códigos de icono de OpenWeatherMap a emojis
    switch (iconCode) {
        case '01d': return '☀️'; // Clear sky day
        case '01n': return '🌙'; // Clear sky night
        case '02d': return '⛅'; // Few clouds day
        case '02n': return '☁️'; // Few clouds night
        case '03d':
        case '03n': return '☁️'; // Scattered clouds
        case '04d':
        case '04n': return ' overcast'; // Broken clouds
        case '09d':
        case '09n': return '🌧️'; // Shower rain
        case '10d':
        case '10n': return '🌦️'; // Rain day/night
        case '11d':
        case '11n': return '⛈️'; // Thunderstorm
        case '13d':
        case '13n': return '🌨️'; // Snow
        case '50d':
        case '50n': return '🌫️'; // Mist
        default: return '☁️';
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tiempo')
        .setDescription('Muestra el tiempo actual o la previsión para una ciudad.')
        .addStringOption(option =>
            option.setName('ciudad')
                .setDescription('El nombre de la ciudad.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('tipo')
                .setDescription('Tipo de información del tiempo (actual o previsión).')
                .setRequired(false)
                .addChoices(
                    { name: 'Actual', value: 'current' },
                    { name: 'Previsión (7 días)', value: 'daily' }
                )),
    async execute(interaction) {
        const ciudad = interaction.options.getString('ciudad');
        const tipo = interaction.options.getString('tipo') || 'current'; // Por defecto: actual

        if (!OPENWEATHER_API_KEY) {
            console.error('OPENWEATHER_API_KEY no está definida en el archivo .env');
            return interaction.reply({
                content: '❌ Lo siento, no puedo obtener el tiempo en este momento. La API Key no está configurada.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        await interaction.deferReply(); // Deferir la respuesta ya que la API puede tardar

        try {
            // Paso 1: Obtener coordenadas de la ciudad
            const geoResponse = await axios.get(GEO_API_URL, {
                params: {
                    q: ciudad,
                    limit: 1, // Solo necesitamos el primer resultado
                    appid: OPENWEATHER_API_KEY
                }
            });

            if (!geoResponse.data || geoResponse.data.length === 0) {
                return interaction.editReply({
                    content: `❌ No pude encontrar la ciudad de **${ciudad}**. ¿Está bien escrito el nombre?`,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            const { lat, lon, name, country } = geoResponse.data[0];

            // Paso 2: Usar la API One Call con las coordenadas
            const weatherResponse = await axios.get(ONE_CALL_API_URL, {
                params: {
                    lat: lat,
                    lon: lon,
                    appid: OPENWEATHER_API_KEY,
                    units: 'metric', // Celsius
                    lang: 'es',      // Español
                    exclude: 'minutely,hourly' // Excluir lo que no necesitamos para reducir el tamaño de la respuesta
                }
            });

            const data = weatherResponse.data;

            const embed = new EmbedBuilder()
                .setColor(0x00BFFF)
                .setTitle(`Tiempo en ${name}, ${country}`);

            if (tipo === 'current') {
                const { current } = data;
                const temperatura = current.temp;
                const sensacionTermica = current.feels_like;
                const humedad = current.humidity;
                const presion = current.pressure; // Presión atmosférica
                const visibilidad = current.visibility / 1000; // Visibilidad en km
                const descripcion = current.weather[0].description;
                const icono = current.weather[0].icon;
                const velocidadViento = (current.wind_speed * 3.6).toFixed(1); // m/s a km/h
                const uvIndex = current.uvi;

                embed.setThumbnail(`http://openweathermap.org/img/wn/${icono}@2x.png`)
                    .setDescription(`${getWeatherEmoji(icono)} ${descripcion.charAt(0).toUpperCase() + descripcion.slice(1)}`)
                    .addFields(
                        { name: '🌡️ Temperatura', value: `${temperatura}°C`, inline: true },
                        { name: '☁️ Sensación térmica', value: `${sensacionTermica}°C`, inline: true },
                        { name: '💧 Humedad', value: `${humedad}%`, inline: true },
                        { name: '🌬️ Viento', value: `${velocidadViento} km/h`, inline: true },
                        { name: '📊 Presión', value: `${presion} hPa`, inline: true },
                        { name: '👁️ Visibilidad', value: `${visibilidad} km`, inline: true },
                        { name: '☀️ Índice UV', value: `${uvIndex}`, inline: true }
                    )
                    .setFooter({ text: 'Actualizado: Hace un momento | Powered by OpenWeatherMap' })
                    .setTimestamp(new Date(current.dt * 1000)); // Usar el timestamp del dato actual
            } else if (tipo === 'daily') {
                embed.setDescription('Previsión para los próximos 7 días:');

                // Recorre los próximos 7 días (excluyendo el día actual que es el primero)
                for (let i = 1; i <= 7 && i < data.daily.length; i++) {
                    const daily = data.daily[i];
                    const date = new Date(daily.dt * 1000).toLocaleDateString('es-ES', { weekday: 'short', month: 'short', day: 'numeric' });
                    const tempMin = daily.temp.min.toFixed(1);
                    const tempMax = daily.temp.max.toFixed(1);
                    const desc = daily.weather[0].description;
                    const icon = daily.weather[0].icon;

                    embed.addFields({
                        name: `\`${date}\``,
                        value: `${getWeatherEmoji(icon)} ${desc.charAt(0).toUpperCase() + desc.slice(1)}\n🌡️ **Min:** ${tempMin}°C / **Max:** ${tempMax}°C`,
                        inline: false
                    });
                }
                embed.setFooter({ text: 'Powered by OpenWeatherMap' });
                embed.setTimestamp();
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error al obtener el tiempo (avanzado):', error.response ? error.response.data : error.message);
            let errorMessage = '❌ Ocurrió un error al intentar obtener la información del tiempo. Inténtalo de nuevo más tarde.';
            if (error.response) {
                if (error.response.status === 401) {
                    errorMessage = '❌ Error de autenticación con la API de OpenWeatherMap. Revisa tu `OPENWEATHER_API_KEY` en el archivo `.env`.';
                } else if (error.response.status === 404) {
                    errorMessage = `❌ No pude encontrar la ciudad de **${ciudad}**. Por favor, verifica el nombre.`;
                }
            }
            await interaction.editReply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
        }
    },
};