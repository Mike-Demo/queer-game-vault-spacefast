/**
 * Every GROQ query the app uses. Public screens read published documents with
 * approved/featured status only; editorial screens read the full set through
 * authorized server functions.
 */

const TAXONOMY = `{ _id, name, "slug": slug.current, abbreviation }`;

export const GAME_SUMMARY_PROJECTION = `{
  _id, title, "slug": slug.current, igdbId, releaseYear, summary, customDescription,
  cover, sourceCoverUrl, editorialStatus, featured,
  "genres": coalesce(genres[]->${TAXONOMY}, []),
  "platforms": coalesce(platforms[]->${TAXONOMY}, []),
  "lgbtqCharacterNames": coalesce(lgbtqCharacters[].name, [])
}`;

export const GAME_DETAIL_PROJECTION = `{
  _id, title, "slug": slug.current, igdbId, releaseYear, summary, customDescription, storyline,
  editorNotes, cover, sourceCoverUrl, editorialStatus, featured, firstReleaseDate,
  "screenshots": coalesce(screenshots[]{ url, caption }, []),
  "themes": coalesce(themes, []),
  "gameModes": coalesce(gameModes, []),
  "ageRatings": coalesce(ageRatings[]{ category, rating, "descriptors": coalesce(descriptors, []) }, []),
  "externalLinks": coalesce(externalLinks[]{ label, url }, []),
  "storeLinks": coalesce(storeLinks[]{ store, url }, []),
  igdbRating, igdbRatingCount, totalRating, igdbCollectionName, franchise,
  gameType, "alternativeNames": coalesce(alternativeNames, []),
  "developer": developer->{ name },
  "publisher": publisher->{ name },
  "involvedCompanies": coalesce(involvedCompanies[]->{ name }, []),
  "genres": coalesce(genres[]->${TAXONOMY}, []),
  "platforms": coalesce(platforms[]->${TAXONOMY}, []),
  "sources": coalesce(sources[]{ publication, title, url, capturedAt }, []),
  "lgbtqCharacters": coalesce(lgbtqCharacters[]{ name, identity, sourceUrl }, []),
  "igdbCharacters": coalesce(igdbCharacters[]{ igdbId, name, description, gender, species, mugshotUrl, igdbUrl }, []),
  popularity, "popularityScores": coalesce(popularityScores[]{ type, value }, []), sourceUpdatedAt,
  importStatus, importedAt, lastSyncedAt

}`;

const PUBLIC_GAME_FILTER = `_type == "game" && editorialStatus in ["approved", "featured"]`;

/** Homepage: editor-featured, publicly visible games. */
export const featuredGamesQuery = `*[${PUBLIC_GAME_FILTER} && (featured == true || editorialStatus == "featured")]
  | order(coalesce(firstReleaseDate, importedAt) desc)[0...$limit] ${GAME_SUMMARY_PROJECTION}`;

/** Library: every publicly visible game. */
export const approvedGamesQuery = `*[${PUBLIC_GAME_FILTER}]
  | order(title asc)[$offset...$end] ${GAME_SUMMARY_PROJECTION}`;

export const approvedGamesCountQuery = `count(*[${PUBLIC_GAME_FILTER}])`;

/** Single public game page. */
export const gameBySlugQuery = `*[${PUBLIC_GAME_FILTER} && slug.current == $slug][0] ${GAME_DETAIL_PROJECTION}`;

const COLLECTION_SUMMARY = `{
  _id, title, "slug": slug.current, description, coverImage, featured, status,
  "gameCount": count(games[@->editorialStatus in ["approved", "featured"]])
}`;

export const featuredCollectionsQuery = `*[_type == "gameCollection" && status == "published" && featured == true]
  | order(coalesce(publishedAt, _createdAt) desc)[0...$limit] ${COLLECTION_SUMMARY}`;

export const publishedCollectionsQuery = `*[_type == "gameCollection" && status == "published"]
  | order(coalesce(publishedAt, _createdAt) desc) ${COLLECTION_SUMMARY}`;

export const collectionBySlugQuery = `*[_type == "gameCollection" && status == "published" && slug.current == $slug][0]{
  _id, title, "slug": slug.current, description, curatorNotes, coverImage, featured, status,
  "gameCount": count(games[@->editorialStatus in ["approved", "featured"]]),
  "games": coalesce(games[@->editorialStatus in ["approved", "featured"]]->${GAME_SUMMARY_PROJECTION}, [])
}`;

/** Collections that include the game with the given slug. */
export const gameCollectionsBySlugQuery = `*[_type == "gameCollection" && status == "published"
  && $slug in games[]->slug.current]
  | order(title asc){ title, "slug": slug.current }`;

/** Editorial: everything awaiting or in review (authorized reads only). */
export const reviewQueueQuery = `*[_type == "game" && editorialStatus in ["imported", "underReview"]]
  | order(coalesce(importedAt, _createdAt) desc) ${GAME_DETAIL_PROJECTION}`;

export const siteSettingsQuery = `*[_type == "siteSettings"][0]{
  appName, description, logo,
  "primaryNavigation": coalesce(primaryNavigation[]{ label, path }, []),
  homepageHeading, homepageIntroduction, emptyStateCopy, footerContent,
  defaultSeoTitle, defaultSeoDescription
}`;

export const navigationQuery = `*[_type == "siteSettings"][0]{
  appName, "primaryNavigation": coalesce(primaryNavigation[]{ label, path }, [])
}`;

export const contentPageBySlugQuery = `*[_type == "contentPage" && slug.current == $slug][0]{
  _id, title, "slug": slug.current, summary, body, featuredImage, seoTitle, seoDescription, publishedAt
}`;

/** Import guard: does this IGDB game already exist? */
export const gameByIgdbIdQuery = `*[_type == "game" && igdbId == $igdbId][0]{
  _id, title, "slug": slug.current, igdbId, editorialStatus, featured, lastSyncedAt, importedAt
}`;

export const gamesByIgdbIdsQuery = `*[_type == "game" && igdbId in $igdbIds]{
  _id, title, "slug": slug.current, igdbId, editorialStatus
}`;

export const importHistoryQuery = `*[_type == "importRecord"] | order(coalesce(requestedAt, _createdAt) desc)[0...$limit]{
  _id, igdbId, gameTitle, operation, result, requestedAt, completedAt,
  "fieldsChanged": coalesce(fieldsChanged, []),
  "warningMessages": coalesce(warningMessages, []),
  errorMessage,
  "game": game->{ _id, title, "slug": slug.current }
}`;

/** Sitemap: publicly visible game slugs, paginated by stable _id order. */
export const sitemapGameSlugsQuery = `*[${PUBLIC_GAME_FILTER} && defined(slug.current)]
  | order(_id asc)[$start...$end]{ "slug": slug.current, "lastmod": _updatedAt }`;

/** Sitemap: published collection slugs, paginated by stable _id order. */
export const sitemapCollectionSlugsQuery = `*[_type == "gameCollection" && status == "published" && defined(slug.current)]
  | order(_id asc)[$start...$end]{ "slug": slug.current, "lastmod": _updatedAt }`;

/** Related games: shares at least one genre with the given game. */
export const relatedGamesQuery = `*[${PUBLIC_GAME_FILTER} && _id != $id && count((genres[]->_id)[@ in $genreIds]) > 0]
  | order(coalesce(igdbRating, 0) desc)[0...$limit] ${GAME_SUMMARY_PROJECTION}`;

/** Public discovery search: free text (title or LGBTQ+ character name) plus optional genre, platform and theme. */
export const searchGamesQuery = `*[${PUBLIC_GAME_FILTER}
  && ($term == "" || title match $term || lgbtqCharacters[].name match $term)
  && ($genre == "" || $genre in genres[]->slug.current)
  && ($platform == "" || $platform in platforms[]->slug.current)
  && ($theme == "" || $theme in themes)]
  | order(title asc)[0...$limit] ${GAME_SUMMARY_PROJECTION}`;

/** Filter options, limited to taxonomy actually used by publicly visible games. */
export const discoverFacetsQuery = `{
  "genres": *[_type == "genre" && count(*[${PUBLIC_GAME_FILTER} && references(^._id)]) > 0]
    | order(name asc){ _id, name, "slug": slug.current },
  "platforms": *[_type == "platform" && count(*[${PUBLIC_GAME_FILTER} && references(^._id)]) > 0]
    | order(name asc){ _id, name, "slug": slug.current },
  "themes": array::unique(*[${PUBLIC_GAME_FILTER}].themes[])
}`;

/** Public API: title/character search with optional facet filters and offset paging. */
const PUBLIC_API_GAME_FILTER = `${PUBLIC_GAME_FILTER}
  && ($term == "" || title match $term || lgbtqCharacters[].name match $term)
  && ($genre == "" || $genre in genres[]->slug.current)
  && ($platform == "" || $platform in platforms[]->slug.current)
  && ($theme == "" || $theme in themes)
  && ($year == 0 || releaseYear == $year)`;

export const publicApiGamesQuery = `{
  "total": count(*[${PUBLIC_API_GAME_FILTER}]),
  "games": *[${PUBLIC_API_GAME_FILTER}] | order(title asc)[$offset...$end] ${GAME_SUMMARY_PROJECTION}
}`;


/** llms-full.txt: every public game title and slug. */
export const llmsGamesQuery = `*[${PUBLIC_GAME_FILTER} && defined(slug.current)]
  | order(title asc){ title, "slug": slug.current, releaseYear }`;
