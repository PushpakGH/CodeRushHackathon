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
test('owner can compose project context and members receive a read-only view',async({page})=>{
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button',{name:/Explore the local sample preview/i}).click();
  await page.evaluate(()=>{
    window.vibecrewPublishDocument=async()=>{};
    window.dispatchEvent(new CustomEvent('vibecrew:context',{detail:{projectId:'synthetic-test',documents:[],canPublish:true}}));
  });
  await page.locator('.nav-item[data-route=discovery]').click();
  await expect(page.getByText('No documents published yet.',{exact:false})).toBeVisible();
  await page.getByLabel('Title',{exact:true}).fill('Team plan');
  await page.getByLabel('Markdown content',{exact:true}).fill('Build a usable shared context flow.');
  await page.getByRole('button',{name:'Publish shared context',exact:true}).click();
  await expect(page.locator('.context-library [role="status"]')).toHaveText('Published. Members and IDEs can fetch the new revision.');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('vibecrew:context',{detail:{projectId:'synthetic-test',canPublish:false,documents:[{kind:'plan',title:'Team plan',body:'Published plan',version:1}]}})));
  await expect(page.getByRole('button',{name:'Publish shared context',exact:true})).toHaveCount(0);
  await page.getByText('Team plan · plan · v1',{exact:true}).click();
  await expect(page.getByText('Published plan',{exact:true})).toBeVisible();
});
