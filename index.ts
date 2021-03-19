import axios from 'axios';
import * as papa from 'papaparse';
import * as nunjucks from 'nunjucks';
import * as fs from 'fs-extra';
import * as glob from 'glob-promise';
import * as yaml from 'js-yaml'
import * as dotenv from 'dotenv';

const expandEnv = (text: string) => {
    return text.replace(/[$][{]?\w*[}]?/g, function (match) {
        const sub = process.env[match.replace(/^[$][{]?/, '').replace(/[}]?$/, '')];
        return sub || match;
    });
}

dotenv.config();

(async () => {
    const cwd = process.argv[2] || process.cwd();
    const alarmaCnf: any = yaml.load(expandEnv(await fs.readFile(`${cwd}/alarma.yml`, 'utf8')));
    const packageJson = JSON.parse(await fs.readFile(`package.json`, 'utf8'));
    const version = packageJson['version'];

    const ymlFiles = await glob.promise(`${cwd}/triggers/**/*.yml`);

    for (const ymlFilePath of ymlFiles) {
        const trigger: any = yaml.load(expandEnv(await fs.readFile(ymlFilePath, 'utf8')));

        for (const elasticCnf of alarmaCnf['elastics']) {
            const elasticNjkInput = {
                id: elasticCnf.id,
                url: elasticCnf.url
            }

            const data = {"query": `${trigger['sql']}`};
            const axiosCnf = {
                validateStatus: () => true,
                headers: {
                    // 'Authorization': `Basic ${Buffer.from(`${elasticCnf.username}:${elasticCnf.password}`).toString('base64')}`,
                    'User-Agent': `alarma/${version}`,
                    'Cookie': 'cegosso=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MTY0MzY5NzIsIm5iZiI6MTYxNTgzMjEzMiwidmVyc2lvbiI6MSwiYXV0aGVudGljYXRlZCI6dHJ1ZSwiZW1haWwiOiJtam5AY2Vnby5kayIsImRvbWFpbiI6ImNlZ28uZGsifQ.Xb5_ZrVHHe2kmoh3oTOq5-w-k9cSGjQ8XEwllolhYcrfnmWvUtDrASFiCerXIak4hs56VLO2Kb5oNXA1nDyOag',
                },
            };
            const res = await axios.post(`${elasticCnf.url.replace(/\/$/, '')}/_sql?format=csv`, data, axiosCnf);
            if (res.status !== 200) {
                console.error(res.status, res.data);
                continue;
            }

            const items = (papa.parse(res.data, {header: true, skipEmptyLines: true})).data;

            const thresholds = trigger['thresholds'];
            thresholds.sort((a: any, b: any) => b['target'] - a['target']);

            for (const threshold of thresholds) {
                const itemsExceedingThreshold = items.filter((a: any) => a[trigger['column']] > threshold['target']);
                if (itemsExceedingThreshold.length > 0) {
                    const rendered = nunjucks.renderString(trigger['njk'], {items: itemsExceedingThreshold, elastic: elasticNjkInput, severity: threshold['severity']});
                    console.log(rendered);
                }
            }
        }
    }
})();
