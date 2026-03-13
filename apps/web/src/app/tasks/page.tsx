import TasksPanel from '@/components/tasks';

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const { propertyId } = await searchParams;
  return (
    <div className="h-full flex flex-col">
      <TasksPanel defaultPropertyId={propertyId} />
    </div>
  );
}
