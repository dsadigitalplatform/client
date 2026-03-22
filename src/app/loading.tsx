export default function Loading() {
    return (
        <div
            className='fixed inset-0 flex items-center justify-center px-6 backdrop-blur-sm'
            style={{ backgroundColor: 'rgba(var(--mui-palette-background-defaultChannel) / 0.85)' }}
        >
            <div
                className='flex flex-col items-center gap-3 rounded-2xl px-6 py-5'
                style={{
                    backgroundColor: 'var(--mui-palette-background-paper)',
                    boxShadow: 'var(--mui-customShadows-lg, 0px 8px 28px rgba(0,0,0,0.14))'
                }}
            >
                <div className='relative h-12 w-12'>
                    <div
                        className='absolute inset-0 rounded-full opacity-60'
                        style={{
                            background: 'radial-gradient(circle at center, rgba(99,102,241,0.25) 0%, transparent 70%)'
                        }}
                    />
                    <div
                        className='absolute inset-0 rounded-full border-2 animate-spin'
                        style={{
                            borderColor: 'var(--mui-palette-primary-main)',
                            borderTopColor: 'transparent',
                            borderRightColor: 'rgba(var(--mui-palette-primary-mainChannel) / 0.25)'
                        }}
                    />
                    <div
                        className='absolute inset-2 rounded-full border-2 animate-spin'
                        style={{
                            borderColor: 'rgba(var(--mui-palette-primary-mainChannel) / 0.35)',
                            borderBottomColor: 'transparent',
                            animationDuration: '1.2s'
                        }}
                    />
                </div>
                <div
                    className='text-sm font-medium'
                    style={{ color: 'var(--mui-palette-text-secondary)' }}
                >
                    Loading…
                </div>
            </div>
        </div>
    )
}
