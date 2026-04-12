import Card from '../../components/common/Card'

export default function ParentNotifications() {
  return (
    <div className="p-4 sm:p-6 min-w-0">
      <h1 className="font-display font-bold text-2xl mb-2">Bildirişlər</h1>
      <p className="text-gray-400 text-sm mb-6">Valideyn üçün xəbərdarlıqlar</p>
      <Card className="p-8 text-center max-w-lg mx-auto">
        <div className="text-4xl mb-4">📬</div>
        <p className="text-gray-300 text-sm">Hazırda bildiriş yoxdur</p>
      </Card>
    </div>
  )
}
