import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import api from '../lib/api'

const OrgWorkspaceContext = createContext(null)

export function OrgWorkspaceProvider({ children }) {
  const [workspace, setWorkspace] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = () => {
    setLoading(true)
    return api
      .get('/course/me')
      .then((res) => {
        setWorkspace(res.workspace || null)
        setError(null)
      })
      .catch((err) => {
        setError(err?.message || 'Təşkilat yüklənmədi')
        setWorkspace(null)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [])

  const value = useMemo(
    () => ({
      workspace,
      loading,
      error,
      reload,
      permissions: workspace?.permissions || [],
      can: (key) => Boolean(workspace?.permissions?.includes(key)),
    }),
    [workspace, loading, error],
  )

  return <OrgWorkspaceContext.Provider value={value}>{children}</OrgWorkspaceContext.Provider>
}

export function useOrgWorkspace() {
  const ctx = useContext(OrgWorkspaceContext)
  if (!ctx) {
    return {
      workspace: null,
      loading: true,
      error: null,
      reload: () => {},
      permissions: [],
      can: () => false,
    }
  }
  return ctx
}
