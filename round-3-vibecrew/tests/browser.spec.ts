import {test,expect} from '@playwright/test';

test('sample routes remain usable across viewport sizes', async ({page}) => {
  const errors=[];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button',{name:/Explore the local sample preview/i}).click();
  for (const width of [390,820,1440]) {
    await page.setViewportSize({width,height:900});
    for (const route of ['tasks','context','team','overview']) {
      await page.goto('http://127.0.0.1:5173/#'+route);
      await expect(page.locator('#main-content')).toBeVisible();
      await expect(page.locator('[data-view="'+route+'"]')).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
      if (route === 'tasks') await page.screenshot({path:'test-results/tasks-'+width+'.png',fullPage:true});
    }
    await page.screenshot({path:'test-results/viewport-'+width+'.png',fullPage:true});
  }
  expect(errors).toEqual([]);
});
