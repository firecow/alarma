import axios from 'axios';
import * as papa from 'papaparse';
import * as nunjucks from 'nunjucks';

(async () => {

    const config ={
        headers: {
        }
    };

    try {
        const res = await axios.post('https://elastic-mjn-org.latoyapip.org/_sql?format=csv', {
            "query": 'SELECT host.name as hostname, system.filesystem.mount_point as mount_point, system.filesystem.device_name as device_name, ROUND(MIN(system.filesystem.used.pct) * 100,2) as used FROM metricbeat WHERE system.filesystem.mount_point NOT IN (\'/hostfs/boot\') AND system.filesystem.type = \'ext4\' AND "@timestamp" > NOW() - INTERVAL 10 MINUTE GROUP BY host.name,system.filesystem.mount_point,system.filesystem.device_name'
        }, config);
        const items = (papa.parse(res.data, { header: true, skipEmptyLines: true })).data;
        const rendered = nunjucks.render('templates/filesystem-disk-usage.njk', { items, elastic: { name: 'Playtopia Prod', url: 'https://elastic-mjn-org.latoyapip.org/' } });
        console.log(rendered);
    } catch (e) {
        console.log(e.toJSON());
    }
})()
