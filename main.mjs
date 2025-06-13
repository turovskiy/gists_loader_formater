import { writeFile } from "node:fs/promises";
import path from 'node:path';
import * as dotenv from "dotenv"

dotenv.config()

const allMyGistsPath = path.resolve(process.cwd(), 'json/allMyGists.json');
const gistFomatedPath = path.resolve(process.cwd(), 'json/gist-fomated.md');

export async function doWrite(data, fileName, type) {
  type = type || "beauty";
  try {
    if (type === "beauty") {
      await writeFile(fileName, JSON.stringify(data, null, 2));
      console.log(`Записано beauty ${fileName}`);
    } else if (type === "mini") {
      await writeFile(fileName, JSON.stringify(data));
      console.log(`Записано mini ${fileName}`);
    } else {
      await writeFile(fileName, JSON.stringify(data, null, 2));
      console.log(`Записано beauty ${fileName}`);
    }
  } catch (error) {
    console.error(error);
  }
}

async function checkTokenAndPermissions(token) {
    const response = await fetch('https://api.github.com/user', {
        headers: {
            'Authorization': `token ${token}`,
            'X-GitHub-Api-Version': '2022-11-28'
        }
    });
    
    if (!response.ok) {
        throw new Error(`Токен недійсний: ${response.status}`);
    }
    
    const user = await response.json();
    const scopes = response.headers.get('X-OAuth-Scopes') || '';
    
    console.log(`👤 Авторизований як: ${user.login}`);
    console.log(`🔑 Доступні scopes: ${scopes}`);
    
    if (!scopes.includes('gist')) {
        console.warn('⚠️ УВАГА: Токен не має scope "gist" - приватні gists будуть недоступні!');
        console.log('📋 Для доступу до приватних gists потрібно створити токен з scope "gist"');
    }
    
    return { user, scopes };
}

async function fetchAndWriteAllGists(token) {
    // Спочатку перевіряємо токен
    const { user, scopes } = await checkTokenAndPermissions(token);
    
    let allGists = [];
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
        const url = `https://api.github.com/gists?page=${page}&per_page=100`;
        const headers = {
            'Authorization': `token ${token}`,
            'X-GitHub-Api-Version': '2022-11-28'
        };
        
        console.log(`📡 Запит до: ${url}`);
        
        const response = await fetch(url, { headers });
        
        // Додаткова діагностика
        console.log(`📊 Rate limit залишок: ${response.headers.get('X-RateLimit-Remaining')}`);
        
        if (!response.ok) {
            console.error(`❌ Помилка API: ${response.status} - ${response.statusText}`);
            const errorBody = await response.text();
            console.error(`Деталі помилки: ${errorBody}`);
            throw new Error(`Error: ${response.status}`);
        }
        
        const gists = await response.json();
        
        // Детальна статистика по сторінці
        const pagePublic = gists.filter(g => g.public).length;
        const pagePrivate = gists.filter(g => !g.public).length;
        
        console.log(`📄 Сторінка ${page}: ${gists.length} gists (публічних: ${pagePublic}, приватних: ${pagePrivate})`);
        
        // Виводимо перші 3 gists для діагностики
        if (gists.length > 0) {
            console.log('🔍 Перші gists на сторінці:');
            gists.slice(0, 3).forEach((gist, index) => {
                console.log(`  ${index + 1}. ${gist.public ? '🌐' : '🔒'} ${gist.description || 'Без опису'} (${Object.keys(gist.files).join(', ')})`);
            });
        }
        
        allGists = allGists.concat(gists);
        
        if (gists.length < 100) {
            hasNextPage = false;
            console.log(`✅ Завантажено ${allGists.length} Gists з GitHub`);
        } else {
            page++;
        }
    }

    // Записуємо у файл
    await doWrite(allGists, allMyGistsPath, 'beauty');
    
    // Детальна статистика
    const publicCount = allGists.filter(g => g.public).length;
    const privateCount = allGists.filter(g => !g.public).length;
    
    console.log(`📁 Gists записано у файл allGists.json`);
    console.log(`📈 Статистика: ${allGists.length} загалом (публічних: ${publicCount}, приватних: ${privateCount})`);
    
    if (privateCount === 0 && scopes.includes('gist')) {
        console.log('💡 Можливо, у вас немає приватних gists або вони були створені іншим способом');
    }

    return allGists;
}

(async()=>{
    try {
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            throw new Error('❌ GITHUB_TOKEN не знайдено в змінних середовища');
        }
        
        console.log(`🚀 Запуск завантаження gists...`);
        const all = await fetchAndWriteAllGists(token);
        
        const toMD = all.map((gist) => {
            const url = gist?.html_url;
            const description = gist?.description || 'Без опису';
            const files = Object.keys(gist?.files || {});
            const isPrivate = !gist.public ? ' 🔒' : '';
            const createdAt = new Date(gist.created_at).toLocaleDateString('uk-UA');
            
            return `- [${files.join(', ')}](${url}) - ${description}${isPrivate} *(${createdAt})*`;
        });

        await doWrite(toMD, gistFomatedPath, 'beauty');
        console.log(`📝 Markdown файл створено: ${toMD.length} записів`);
        
    } catch (error) {
        console.error('💥 Помилка виконання:', error.message);
    }
})()