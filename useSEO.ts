import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description?: string;
  keywords?: string[];
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'book';
  alternativeTitles?: string;
  author?: string;
  status?: string;
  releaseYear?: string;
}

export function useSEO({
  title,
  description = 'اقرأ أحدث فصول المانجا والمانهوا المترجمة للعربية بجودة عالية وبدون إعلانات مزعجة على Dark Manhwa. تحديثات يومية وسريعة وخادم متطور.',
  keywords = ['مانجا', 'مانهوا', 'قراءة مانهوا', 'مانهوا مترجمة', 'دارك مانهوا', 'Dark Manhwa', 'فصول مانهوا اونلاين'],
  image = '/logo.png',
  url,
  type = 'website',
  alternativeTitles,
  author,
  status,
  releaseYear
}: SEOProps) {
  useEffect(() => {
    if (!title) return;
    // 1. Update Title
    const siteSuffix = ' | Dark Manhwa';
    const finalTitle = title ? `${title}${siteSuffix}` : 'Dark Manhwa - دارك مانهوا لقراءة المانجا والمانهوا';
    document.title = finalTitle;

    // Helper to set or create meta tag
    const setMetaTag = (attribute: 'name' | 'property', name: string, content: string) => {
      let element = document.querySelector(`meta[${attribute}="${name}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Helper to set or create link tag
    const setLinkTag = (rel: string, href: string) => {
      let element = document.querySelector(`link[rel="${rel}"]`);
      if (!element) {
        element = document.createElement('link');
        element.setAttribute('rel', rel);
        document.head.appendChild(element);
      }
      element.setAttribute('href', href);
    };

    // 2. Core SEO tags
    setMetaTag('name', 'description', description);
    setMetaTag('name', 'keywords', keywords.join(', '));
    
    // 3. Open Graph / Facebook tags
    setMetaTag('property', 'og:title', finalTitle);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:image', image);
    setMetaTag('property', 'og:type', type);
    setMetaTag('property', 'og:locale', 'ar_SA');
    const currentUrl = url || window.location.href;
    setMetaTag('property', 'og:url', currentUrl);
    setMetaTag('property', 'og:site_name', 'Dark Manhwa');

    // 4. Twitter tags
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', finalTitle);
    setMetaTag('name', 'twitter:description', description);
    setMetaTag('name', 'twitter:image', image);

    // 5. Canonical link
    setLinkTag('canonical', currentUrl);

    // 6. Schema.org JSON-LD structured data
    let schemaScript = document.getElementById('seo-jsonld-schema') as HTMLScriptElement | null;
    if (!schemaScript) {
      schemaScript = document.createElement('script');
      schemaScript.id = 'seo-jsonld-schema';
      schemaScript.type = 'application/ld+json';
      document.head.appendChild(schemaScript);
    }

    // Build specific schema based on type
    let schemaData: any = {};

    if (type === 'book') {
      schemaData = {
        '@context': 'https://schema.org',
        '@type': 'ComicSeries',
        'name': title,
        'alternativeHeadline': alternativeTitles || undefined,
        'description': description,
        'image': image,
        'url': currentUrl,
        'author': author ? { '@type': 'Person', 'name': author } : undefined,
        'creativeWorkStatus': status === 'completed' ? 'Completed' : 'Ongoing',
        'copyrightYear': releaseYear || new Date().getFullYear().toString(),
        'inLanguage': 'ar',
        'genre': keywords.filter(k => !k.includes('read') && !k.includes('online')),
        'publisher': {
          '@type': 'Organization',
          'name': 'Dark Manhwa',
          'logo': {
            '@type': 'ImageObject',
            'url': `${window.location.origin}/logo.png`
          }
        }
      };
    } else {
      schemaData = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        'name': 'Dark Manhwa',
        'alternateName': 'دارك مانهوا',
        'description': description,
        'url': currentUrl,
        'potentialAction': {
          '@type': 'SearchAction',
          'target': {
            '@type': 'EntryPoint',
            'urlTemplate': `${window.location.origin}/?search={search_term_string}`
          },
          'query-input': 'required name=search_term_string'
        },
        'publisher': {
          '@type': 'Organization',
          'name': 'Dark Manhwa',
          'logo': {
            '@type': 'ImageObject',
            'url': `${window.location.origin}/logo.png`
          }
        }
      };
    }

    schemaScript.textContent = JSON.stringify(schemaData);

    return () => {};
  }, [title, description, keywords, image, url, type, alternativeTitles, author, status, releaseYear]);
}
