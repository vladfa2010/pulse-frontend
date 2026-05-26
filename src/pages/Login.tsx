import { useEffect } from 'react'
import { useNavigate } from 'react-router'

export default function Login() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/')
  }, [navigate])

  return null
}
