'use server'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY

export async function searchAddresses(query: string) {
  if (!query || query.length < 3) {
    return []
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&language=fr&types=address&key=${GOOGLE_PLACES_API_KEY}`
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error('Failed to fetch address suggestions')
    }
    
    const data = await response.json()
    
    return (data?.predictions || []).map((prediction: { place_id: string; description: string; structured_formatting?: { main_text?: string; secondary_text?: string } }) => ({
      place_id: prediction.place_id,
      description: prediction.description,
      main_text: prediction.structured_formatting?.main_text || '',
      secondary_text: prediction.structured_formatting?.secondary_text || ''
    }))
  } catch (error) {
    console.error('Error fetching address suggestions:', error)
    return []
  }
}

export async function getAddressDetails(placeId: string) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&language=fr&fields=address_components,formatted_address&key=${GOOGLE_PLACES_API_KEY}`
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error('Failed to fetch address details')
    }
    
    const data = await response.json()
    const result = data?.result
    
    if (!result) {
      return null
    }
    
    // Extraire les composants d'adresse
    const components = result.address_components || []
    const addressDetails = {
      formatted_address: result.formatted_address || '',
      street_number: '',
      route: '',
      locality: '',
      postal_code: '',
      country: '',
      administrative_area_level_1: '' // région/état
    }
    

    
    components.forEach((component: { types: string[]; long_name: string; short_name?: string }) => {
      const types = component.types || []
      const longName = component.long_name || ''
      
      if (types.includes('street_number')) {
        addressDetails.street_number = longName
      } else if (types.includes('route')) {
        addressDetails.route = longName
      } else if (types.includes('locality')) {
        addressDetails.locality = longName
      } else if (types.includes('sublocality_level_1') && !addressDetails.locality) {
        // Fallback si pas de locality
        addressDetails.locality = longName
      } else if (types.includes('postal_code')) {
        addressDetails.postal_code = longName
      } else if (types.includes('country')) {
        // Utiliser short_name pour avoir le code pays ISO (FR au lieu de France)
        addressDetails.country = component.short_name || longName
      } else if (types.includes('administrative_area_level_1')) {
        addressDetails.administrative_area_level_1 = longName
      } else if (types.includes('administrative_area_level_2') && !addressDetails.administrative_area_level_1) {
        // Fallback pour certains pays
        addressDetails.administrative_area_level_1 = longName
      }
    })
    

    
    return addressDetails
  } catch (error) {
    console.error('Error fetching address details:', error)
    return null
  }
}
