// Person page (#/person/{tmdbPersonId}): filmography from TMDB credits (by person id, never by name).

import { t, tOr, tmdbLang, lang, errorText } from '../i18n.js';
import { getSetting } from '../settings.js';
import { getPerson, posterUrl } from '../tmdb.js';
import { itemIds } from '../items.js';
import { h, append } from '../ui.js';
import { sheetHead } from './sheet.js';

const CREW_JOBS = ['Director', 'Creator', 'Screenplay', 'Writer', 'Novel', 'Story'];

export async function render({ params, back }) {
  const personId = Number(params[0]);
  const page = h('section', { class: 'page person' }, sheetHead(`#/${back}`));
  const body = h('div', {}, h('div', { class: 'detail-hero skeleton' },
    h('div', { class: 'poster poster-empty' }),
    h('div', { class: 'detail-titles' }, h('div', { class: 'sk-line w70' }), h('div', { class: 'sk-line w40' }))));
  page.append(body);

  if (!getSetting('tmdbKey')) {
    body.replaceChildren(h('div', { class: 'empty' }, h('p', { text: t('add.needKey') }),
      h('a', { class: 'btn primary', href: '#/settings', text: t('add.goSettings') })));
    return page;
  }

  Promise.all([getPerson(personId, { language: tmdbLang() }), itemIds()])
    .then(([person, mine]) => { body.replaceChildren(); append(body, content(person, mine)); })
    .catch((err) => {
      console.error(err);
      body.replaceChildren(h('div', { class: 'empty' }, h('p', { text: errorText(err) })));
    });
  return page;
}

function content(person, mine) {
  const loc = lang() === 'fr' ? 'fr-FR' : 'en-US';
  const fmt = (d) => new Date(d).toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' });
  const life = person.birthday
    ? (person.deathday ? `${fmt(person.birthday)} – ${fmt(person.deathday)}` : t('person.born', { date: fmt(person.birthday) }))
    : '';

  const bio = person.biography && h('p', { class: 'bio clamp', text: person.biography });
  if (bio) bio.addEventListener('click', () => bio.classList.toggle('clamp'));

  // Show the person's main trade first (a director's films before their cameos).
  const directing = person.department && person.department !== 'Acting';
  const sections = [
    { key: 'person.asCrew', list: person.crew },
    { key: 'person.asCast', list: person.cast },
  ];
  if (!directing) sections.reverse();

  return [
    h('div', { class: 'detail-hero' },
      person.profilePath
        ? h('img', { class: 'poster', src: posterUrl(person.profilePath, 'w185'), alt: '', width: 185, height: 278 })
        : h('div', { class: 'poster poster-empty', 'aria-hidden': 'true' }),
      h('div', { class: 'detail-titles' },
        h('h1', { class: 'detail-title', text: person.name }),
        person.department && h('p', { class: 'detail-facts', text: tOr(`dept.${person.department}`, person.department) }),
        life && h('p', { class: 'detail-facts', text: life }),
      )),
    bio,
    ...sections.filter((s) => s.list.length).map((s) => h('section', { class: 'credits' },
      h('h2', { text: `${t(s.key)} (${s.list.length})` }),
      h('ul', { class: 'results' }, s.list.map((c) => creditRow(c, mine.has(`${c.type}:${c.tmdbId}`)))))),
    !person.cast.length && !person.crew.length && h('p', { class: 'muted center', text: t('person.noCredits') }),
  ];
}

function creditRow(c, inList) {
  const role = c.role.split(', ').map((r) => (CREW_JOBS.includes(r) ? t(`job.${r}`) : r)).join(', ');
  return h('li', {},
    h('a', { class: 'result', href: `#/add/${c.type}/${c.tmdbId}` },
      h('span', { class: 'thumb' }, c.posterPath
        ? h('img', { src: posterUrl(c.posterPath, 'w92'), alt: '', loading: 'lazy', width: 46, height: 69 })
        : h('span', { class: 'thumb-empty' })),
      h('span', { class: 'result-text' },
        h('span', { class: 'result-title', text: c.title }),
        role && h('span', { class: 'result-sub', text: role }),
        h('span', { class: 'result-meta' },
          h('span', { class: `badge ${c.type}`, text: t(`type.${c.type}`) }),
          h('span', { text: c.year ?? t('person.upcoming') }),
          inList && h('span', { class: 'badge inlist', text: t('add.inList') })),
      )));
}
