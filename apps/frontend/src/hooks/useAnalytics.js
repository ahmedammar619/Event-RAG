import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { analyticsService } from '../services/api'

// Generate or get session ID
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('analytics_session')
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem('analytics_session', sessionId)
  }
  return sessionId
}

// Get landing page (first page visited)
const getLandingPage = () => {
  let landingPage = sessionStorage.getItem('landing_page')
  if (!landingPage) {
    landingPage = window.location.pathname
    sessionStorage.setItem('landing_page', landingPage)
  }
  return landingPage
}

// Parse user agent to get device info
const getDeviceInfo = () => {
  const ua = navigator.userAgent

  // Detect device type
  let deviceType = 'desktop'
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    deviceType = 'tablet'
  } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    deviceType = 'mobile'
  }

  // Detect browser
  let browser = 'Unknown'
  if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('SamsungBrowser')) browser = 'Samsung Browser'
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera'
  else if (ua.includes('Edge')) browser = 'Edge'
  else if (ua.includes('Edg')) browser = 'Edge'
  else if (ua.includes('Chrome')) browser = 'Chrome'
  else if (ua.includes('Safari')) browser = 'Safari'
  else if (ua.includes('MSIE') || ua.includes('Trident')) browser = 'IE'

  // Detect OS
  let os = 'Unknown'
  if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac')) os = 'macOS'
  else if (ua.includes('Linux')) os = 'Linux'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'

  return { deviceType, browser, os }
}

// Parse UTM parameters
const getUtmParams = () => {
  const params = new URLSearchParams(window.location.search)
  return {
    utmSource: params.get('utm_source'),
    utmMedium: params.get('utm_medium'),
    utmCampaign: params.get('utm_campaign')
  }
}

export default function useAnalytics(userId = null) {
  const location = useLocation()
  const lastPath = useRef(null)

  useEffect(() => {
    // Only track if path changed
    if (lastPath.current === location.pathname) return
    lastPath.current = location.pathname

    const { deviceType, browser, os } = getDeviceInfo()
    const { utmSource, utmMedium, utmCampaign } = getUtmParams()

    const trackData = {
      sessionId: getSessionId(),
      userId,
      userAgent: navigator.userAgent,
      deviceType,
      browser,
      os,
      referrer: document.referrer || null,
      landingPage: getLandingPage(),
      currentPage: location.pathname,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      language: navigator.language,
      utmSource,
      utmMedium,
      utmCampaign,
      eventType: 'pageview'
    }

    analyticsService.track(trackData)
  }, [location.pathname, userId])
}

// Track custom events
export const trackEvent = (eventType, additionalData = {}) => {
  const { deviceType, browser, os } = getDeviceInfo()

  const trackData = {
    sessionId: getSessionId(),
    userAgent: navigator.userAgent,
    deviceType,
    browser,
    os,
    currentPage: window.location.pathname,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    language: navigator.language,
    eventType,
    ...additionalData
  }

  analyticsService.track(trackData)
}
