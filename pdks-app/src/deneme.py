useEffect(() => {
  async function fetchPersoneller() {
    const { data, error } = await supabase
      .from('personel')
      .select('*');

    if (error) {
      console.error('Veri çekme hatası:', error);
      setError('Veriler yüklenirken hata oluştu: ' + error.message);
      setPersoneller([]);
    } else {
      console.log('Gelen veri:', data);  // Konsola gelen veriyi yazdır
      setPersoneller(data || []);
      setError(null);
    }

    setLoading(false);
  }

  fetchPersoneller();
}, []);
