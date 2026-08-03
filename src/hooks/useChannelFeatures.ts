import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

interface ChannelFeatures {
  telegram: boolean
  push: boolean
  email: boolean
  loading: boolean
}

export function useChannelFeatures(): ChannelFeatures {
  const [channels, setChannels] = useState<ChannelFeatures>({
    telegram: true,
    push: true,
    email: true,
    loading: true,
  })

  useEffect(() => {
    api
      .get('/user/channel-status')
      .then((data) =>
        setChannels({
          telegram: !!data.telegram,
          push: !!data.push,
          email: true,
          loading: false,
        })
      )
      .catch(() => setChannels((prev) => ({ ...prev, loading: false })))
  }, [])

  return channels
}
