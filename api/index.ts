import { NowRequest, NowResponse } from '@vercel/node';
import fetch from 'node-fetch';

const { GITLAB_TOKEN, DISCORD_WEBHOOK_URL } = process.env;
const THEME_COLOR = 3828722;
const METADATA_TITLE = /(?=(?:---))[^Ї]+title:[^']*'([^']*)'/gm;
const METADATA_DATE = /(?=(?:---))[^Ї]+date:[^']*'([^']*)'/gm;

const getMetadata = (text: string, regex: RegExp) => regex.exec(text)[1];

interface GitlabJobEvent {
  build_name: 'build' | 'deploy';
  build_status: 'failed' | 'pending' | 'success';
  commit: {
    message: string;
  };
  repository: {
    name: string;
  };
}

const newsGitlabBasePath =
  'https://gitlab.com/justmc/justcontent/-/raw/master/content/news';

const newsWebsiteBasePath = 'https://justmc.ru/news';

// Достаёт из текста упомянутые новости
const getReferencedNews = (commitMessage: string) => {
  const message = commitMessage;
  const regex = /(news\(([^)]+)\))/gm;

  const result: string[] = [];
  let groups: string[] = [];

  while ((groups = regex.exec(message))) {
    result.push(groups[2]);
  }

  return result;
};

export default async (request: NowRequest, response: NowResponse) => {
  // Проверяем токен
  if (request.headers['x-gitlab-token'] !== GITLAB_TOKEN)
    response.status(401).json({ error: 'Unathorized' });

  const invalidWebhook = () =>
    response.status(401).json({ error: 'Invalid webhook' });

  // Проверяем событие от гитлаба
  if (request.headers['x-gitlab-event'] !== 'Job Hook') return invalidWebhook();

  const {
    repository,
    build_name,
    build_status,
    commit,
  } = request.body as GitlabJobEvent;

  // Выполняем код, только если деплой закончился
  if (
    repository.name !== 'JustWebsite' ||
    build_name !== 'deploy' ||
    build_status !== 'success'
  )
    return invalidWebhook();

  // Ищем упомянутые новости из названия коммита
  // К примеру, `Изменил что-то; Добавил новость news(update_19_12_2020)` вернёт ['update_19_12_2020']
  const referencedNews = getReferencedNews(commit.message);

  // Если нет упомянутых новостей, то ничего не делаем.
  if (referencedNews.length === 0)
    return response
      .status(400)
      .json({ error: 'No referenced news in commit message' });

  await Promise.all(
    referencedNews.map(async (pageName) => {
      const path = `${newsGitlabBasePath}/${pageName}.md`;
      const page = await fetch(path);
      const pageText = await page.text();

      console.log(path, pageText);

      // Убираем метадату новости
      const metaDataText = pageText.split('---');
      metaDataText.shift();
      metaDataText.shift();

      const fullText = metaDataText.join('---').trim();

      // Сжимаем текст до 300 символов
      const text =
        fullText.length > 300
          ? fullText.substring(0, 297).trim() + '...'
          : fullText;

      const message = {
        embeds: [
          {
            title: getMetadata(pageText, METADATA_TITLE),
            color: THEME_COLOR,
            image: {
              url: `https://gitlab.com/justmc/justcontent/-/raw/master/content/news/thumbnails/${pageName}.png`,
            },
            footer: {
              text: 'JustMC',
            },
            timestamp: getMetadata(pageText, METADATA_DATE),
            description: `${text}
              
              [Читать на сайте](${newsWebsiteBasePath}/${pageName})
              `,
          },
        ],
      };

      console.log(message);

      // Отправляем сообщение в дискорд
      await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        body: JSON.stringify(message),
        headers: {
          'Content-Type': 'application/json',
        },
      })
        .then((r) => r.text())
        .then(console.log);
    })
  );

  response.status(200).json({ success: true });
};
