import { asc } from 'drizzle-orm';
import { properties, propertyFaqs } from '@walt/db';
import { db } from '@/lib/db';
import { RunAnalysisButton, AnswerEditor } from './FaqEditor';

export default async function QuestionsPage() {
  const [allProperties, allFaqs] = await Promise.all([
    db.select({ id: properties.id, name: properties.name }).from(properties).orderBy(asc(properties.name)),
    db.select().from(propertyFaqs).orderBy(asc(propertyFaqs.category))
  ]);

  // Group FAQs by propertyId
  const faqsByProperty = new Map<string, typeof allFaqs>();
  for (const faq of allFaqs) {
    const list = faqsByProperty.get(faq.propertyId) ?? [];
    list.push(faq);
    faqsByProperty.set(faq.propertyId, list);
  }

  const totalFaqs = allFaqs.length;
  const lastAnalysed = allFaqs.reduce<Date | null>((latest, f) => {
    if (!latest || f.analysedAt > latest) return f.analysedAt;
    return latest;
  }, null);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Common Questions</h1>
          {totalFaqs > 0 ? (
            <p className="text-sm text-gray-500 mt-1">
              {totalFaqs} categor{totalFaqs !== 1 ? 'ies' : 'y'} across {allProperties.length} propert{allProperties.length !== 1 ? 'ies' : 'y'}
              {lastAnalysed && (
                <span className="ml-2">· Last analysed {lastAnalysed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              )}
            </p>
          ) : (
            <p className="text-sm text-gray-500 mt-1">Run analysis to build your Q&amp;A knowledge base</p>
          )}
        </div>
        <RunAnalysisButton />
      </div>

      {totalFaqs === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
          {allProperties.length === 0
            ? 'No properties yet. Sync data first.'
            : 'Click "Run Analysis" to discover common guest questions per property.'}
        </div>
      ) : (
        <div className="space-y-8">
          {allProperties.map((prop) => {
            const faqs = faqsByProperty.get(prop.id);
            if (!faqs || faqs.length === 0) return null;
            return (
              <div key={prop.id}>
                <h2 className="text-base font-semibold text-gray-800 mb-3">{prop.name}</h2>
                <div className="space-y-4">
                  {faqs.map((faq) => (
                    <div key={faq.id} className="rounded-lg border border-gray-200 bg-white p-5">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-900">{faq.category}</h3>
                      </div>
                      {faq.examples && faq.examples.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Example messages</p>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {(faq.examples as string[]).map((ex, i) => (
                              <li key={i} className="truncate">"{ex}"</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <AnswerEditor faqId={faq.id} initialAnswer={faq.answer} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
