export interface BssdhYear {
  year: string;
  edition: string;
  dates: string;
  place: string;
  theme: string;
  image: string;
  topics: readonly string[];
  externalUrl?: string;
}

export const bssdhYears: readonly BssdhYear[] = [
  { year:'2026', edition:'8th', dates:'3–7 August 2026', place:'National Library of Latvia, Riga', theme:'Cultural Data Analytics and Meaning', image:'/assets/bssdh/bssdh-2026-banner.webp', topics:['OpenRefine','Orange Data Mining','LLMs via API','Network analysis','Flourish'] },
  { year:'2025', edition:'7th', dates:'4–8 August 2025', place:'House of Science, University of Latvia, Riga', theme:'Digital Methods for History Research', image:'/assets/bssdh/2025.jpg', topics:['Handwritten text recognition','Historical networks','GIS and mapping','AI for humanities'] },
  { year:'2024', edition:'6th', dates:'22–26 July 2024', place:'Riga', theme:'Large Language Models and Small Languages', image:'/assets/bssdh/2024.jpg', topics:['Large language models','Small languages','Language technologies','Digital research skills'] },
  { year:'2023', edition:'5th', dates:'25–28 July 2023', place:'National Library of Latvia and online', theme:'Discourse Analysis and Digital Literary Studies', image:'/assets/bssdh/2023.jpeg', topics:['Python','Web scraping','Tableau','Gephi','Digital literary studies'] },
  { year:'2022', edition:'4th', dates:'26–29 July 2022', place:'National Library of Latvia and online', theme:'Essentials of News Data Mining', image:'/assets/bssdh/2022.jpg', topics:['News data mining','Python and R','Web harvesting','Network visualisation'] },
  { year:'2021', edition:'3rd', dates:'23–26 August 2021', place:'National Library of Estonia, Tallinn and online', theme:'Digital Methods in Humanities and Social Sciences', image:'', topics:[], externalUrl:'https://digilab.rara.ee/en/events/baltic-summer-school-of-digital-humanities-2021-digital-methods-in-humanities-and-social-sciences-en/' },
  { year:'2019', edition:'2nd', dates:'23–26 July 2019', place:'Riga', theme:'Essentials of Coding and Encoding', image:'/assets/bssdh/2019.png', topics:['Python','Text encoding','Topic modelling','Palladio','Digital newspapers'] },
  { year:'2018', edition:'1st', dates:'17–20 July 2018', place:'Riga', theme:'Text Mining, Mapping and Visualization', image:'/assets/bssdh/2018.png', topics:['Corpus analysis','Computational stylistics','Data journalism','GIS','Data visualisation'] }
] as const;

export const lectures2026 = [
  ['Beyond the Canvas: Multimodal Interpretation of Art Masterpieces via Google Nano Banana 2','Aldis Ērglis'],
  ['Computer as Archive, Computer as Agent: Tracing the Evolution of the Digital Humanities from the 1960s to an Uncertain Future','Tessa Gengnagel'],
  ['Decoding 18th-century British Masonic Print Culture: Press Trends, Publication Networks, and Constitutional Authorship Attribution','Róbert Péter'],
  ['Structured Data Approaches to Historical Collections: Methods and Insights','Sonja Dorfbauer and Simon Mayer']
] as const;

export const workshops2026 = [
  ['Data Cleaning, Analysis, and Visualization with OpenRefine and Orange','Lars Kjær'],
  ['Network Analysis for Humanists','Giovanni Pietro Vitali'],
  ['Using LLMs in Humanities Research via API','Valdis Saulespurēns'],
  ['Data Visualization for Public-Facing Research','Anda Baklāne']
] as const;
