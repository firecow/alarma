import axios from 'axios';
import * as papa from 'papaparse';
import * as nunjucks from 'nunjucks';
import * as fs from 'fs-extra';
import * as glob from 'glob-promise';
import * as yaml from 'js-yaml'
import * as dotenv from 'dotenv';
import * as path from 'path';

const expandEnv = (text) => {
    return text.replace(/[$][{]?\w*[}]?/g, function (match) {
        const sub = process.env[match.replace(/^[$][{]?/, '').replace(/[}]?$/, '')];
        return sub || match;
    });
}

dotenv.config();

(async () => {
    const version = '1.0.0'
    const cwd = process.argv[2] || process.cwd();
    const alarmaCnf = yaml.load(expandEnv(await fs.readFile(`${cwd}/alarma.yml`, 'utf8')));

    const ymlFiles = await glob.promise(`${cwd}/**/*.yml`);
    ymlFiles.splice(ymlFiles.indexOf(path.normalize(`${cwd}/alarma.yml`)), 1);

    for (const ymlFile of ymlFiles) {
        const yml = yaml.load(expandEnv(await fs.readFile(ymlFile, 'utf8')));
        const njk = await fs.readFile(ymlFile.replace('.yml', '.jinja2.html'), 'utf8');
        const sql = await fs.readFile(ymlFile.replace('.yml', '.sql'), 'utf8');

        for (const elasticCnf of alarmaCnf.elastics) {
            const elasticNjkInput = {
                id: elasticCnf.id,
                url: elasticCnf.url
            }

            const data = {query: `${sql}`};
            const axiosCnf = {
                validateStatus: () => true,
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${elasticCnf.username}:${elasticCnf.password}`).toString('base64')}`,
                    'User-Agent': `alarma/${version}`
                },
            };
            const res = await axios.post(`${elasticCnf.url}/_sql?format=csv`, data, axiosCnf);
            const items = (papa.parse(res.data, {header: true, skipEmptyLines: true})).data;
            const rendered = nunjucks.renderString(njk, {items, elastic: elasticNjkInput});
            console.log(rendered);

        }
    }
})();
