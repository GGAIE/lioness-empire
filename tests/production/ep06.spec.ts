import { ep06Checks } from '../helpers/ep06-checks';
ep06Checks();

import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { root } from '../../scripts/load-content';
test('production ships all 157 original PNGs for the fifth chapter finale and EP06', async ({
  request,
}) => {
  test.setTimeout(60000);
  let count = 0;
  for (const folder of [
    'ep05/act05',
    'ep06/act01',
    'ep06/act02',
    'ep06/act03',
    'ep06/act04',
    'ep06/act05',
  ]) {
    const audit = JSON.parse(
      await readFile(`${root}/content/sources/${folder}/asset-audit.json`, 'utf8')
    );
    for (const image of audit.images) {
      const r = await request.get('/' + image.path);
      expect(r.status()).toBe(200);
      expect(
        createHash('sha256')
          .update(await r.body())
          .digest('hex')
      ).toBe(image.sha256);
      await r.dispose();
      count++;
    }
  }
  expect(count).toBe(157);
});
