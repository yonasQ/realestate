/**
 * Initial site settings inserted on first import. Everything here is editable in
 * /admin/settings. Realtor contact fields are intentionally empty: they must be
 * filled with the realtor's real details before launch (see docs/LAUNCH_CHECKLIST.md).
 */
export const DEFAULT_SITE_SETTINGS = {
  id: 1,
  brandName: 'Addis Homes',
  brandTagline: 'Realtor for Temer Properties developments',
  realtorName: null,
  realtorTitle: 'Realtor representing Temer Properties developments',
  realtorBio: null,
  phone: null,
  whatsapp: null,
  email: null,
  telegram: null,
  officeAddress: null,
  officeHours: null,
  relationshipStatement:
    'I am a realtor representing developments by Temer Properties. I am not the developer: Temer Properties designs, builds and sells these properties, and every price, unit allocation, payment schedule and sale contract is confirmed directly by Temer Properties.',
  developerName: 'Temer Properties',
  developerWebsite: 'https://temerproperties.com/',
  developerPhone: '+251975666699',
  developerHotline: '6033',
  developerEmail: 'info@temerproperties.com',
  developerAddress: 'Woldemaryam Building, Sarbet – Kera Road, Addis Ababa',
  social: {},
  heroHeadline: 'New homes across Addis Ababa, chosen with care',
  heroSubheadline:
    'Apartments and commercial spaces in Temer Properties developments in Sarbet, Aware, Ayat, Piassa and Gelan, with a dedicated realtor to guide your search, your site visit and your purchase.',
} as const
