# PDKS (Personel Devam Kontrol Sistemi)

Bu proje, React ve Supabase kullanılarak geliştirilmiş bir Personel Devam Kontrol Sistemi uygulamasıdır.

## Özellikler

- 👥 **Çalışan Yönetimi**: Personel ekleme, silme, listeleme
- 📊 **Devam Takibi**: Giriş/çıkış kayıtları ve raporlama
- 🔐 **Admin Paneli**: Kayıt düzenleme ve sistem ayarları
- 📱 **Responsive Tasarım**: Mobil uyumlu arayüz
- 🔄 **ZK Cihaz Entegrasyonu**: Otomatik veri senkronizasyonu

## Kurulum

1. Projeyi klonlayın:
```bash
git clone <repository-url>
cd pdks-app
```

2. Bağımlılıkları yükleyin:
```bash
npm install
```

3. Environment variables ayarlayın:
`.env` dosyası oluşturun ve aşağıdaki değişkenleri tanımlayın:
```
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Uygulamayı başlatın:
```bash
npm start
```

## Teknolojiler

- **Frontend**: React 18.3.1
- **Backend**: Supabase (PostgreSQL + Auth)
- **Python Scripts**: ZK cihaz entegrasyonu
- **Styling**: CSS3

## Güvenlik

- Supabase Row Level Security (RLS) aktif
- Environment variables ile güvenli konfigürasyon
- Error Boundary ile hata yakalama

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
