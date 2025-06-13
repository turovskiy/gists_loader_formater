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
    }
    if (type === "mini") {
      await writeFile(fileName, JSON.stringify(data));
      console.log(`Записано mini ${fileName}`);
    } else {
      await writeFile(fileName, JSON.stringify(data, null, 2));
      console.log(`Записано beauty ${fileName}`);
    }
  } catch (error) {
    console.error(error); // Вивести помилку
  }
}

async function fetchAndWriteAllGists(username, token) {
    let allGists = [];
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
        const url = `https://api.github.com/users/${username}/gists?page=${page}&per_page=100`; // Використання пагінації
        const headers = {
            'Authorization': `token ${token}`,
            'X-GitHub-Api-Version': '2022-11-28'
        };
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        const gists = await response.json();
        allGists = allGists.concat(gists);
        if (gists.length < 100) {
            hasNextPage = false;
        } else {
            page++;
        }
    }

    // Записуємо у файл
	await doWrite(allGists,allMyGistsPath, 'beauty');
    console.log(`Gists було успішно записано у файл allGists.json. Загальна кількість Gists: ${allGists.length}`);

    return allGists;
}

(async()=>{
    const all = await fetchAndWriteAllGists('turovskiy', process.env.GITHUB_TOKEN);
    const toMD = await all.flatMap((gist) => {
        const   url = gist?.html_url, 
                description = gist?.description, 
                files = Object.keys(gist?.files),
                obj = {url, description, files}
        return `[${files}](${url})`
    })

   await doWrite(toMD, gistFomatedPath, 'beauty')
})()

