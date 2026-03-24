'use client'

import { useState } from 'react'

import Link from 'next/link'

import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import MuiLink from '@mui/material/Link'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Fab from '@mui/material/Fab'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import { useAssociates } from '@features/associates/hooks/useAssociates'
import AssociatesCreateForm from '@features/associates/components/AssociatesCreateForm'

const AssociatesList = () => {
    const { associates, loading, search, setSearch, refresh } = useAssociates()
    const [openAdd, setOpenAdd] = useState(false)
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

    const handleExport = () => {
        const rows = [
            ['Associate Name', 'Company Name', 'Associate Type', 'Country Code', 'Mobile', 'Email', 'Payout (%)', 'Code', 'PAN Card No', 'IsActive'],
            ...associates.map(a => [
                a.associateName,
                a.companyName,
                a.associateTypeName ?? '',
                a.countryCode,
                a.mobile,
                a.email ?? '',
                a.payout != null ? String(a.payout) : '',
                a.code,
                a.pan ?? '',
                a.isActive ? 'Yes' : 'No'
            ])
        ]

        const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')

        a.href = url
        a.download = 'associates.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <Box className='flex flex-col gap-4' sx={{ mx: { xs: -2, sm: 0 } }}>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    gap: 2,
                    justifyContent: 'space-between'
                }}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1 }}>
                    <Typography variant='h5'>Associates</Typography>
                    <Typography variant='body2' color='text.secondary'>
                        Manage associate records
                    </Typography>
                </Box>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        gap: 1.5,
                        alignItems: { sm: 'center' },
                        flex: 1
                    }}
                >
                    <TextField
                        sx={{ minWidth: 350 }}
                        size='small'
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder='Search by name, company, email, mobile or code'
                        onKeyDown={e => {
                            if (e.key === 'Enter') refresh()
                        }}
                        fullWidth={isMobile}
                    />
                    {isMobile ? null : (
                        <Button variant='contained' onClick={refresh} sx={{ minWidth: 110 }}>
                            Search
                        </Button>
                    )}
                    {isMobile ? null : (
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'flex-end', flex: 1 }}>
                            <Button variant='outlined' onClick={handleExport} startIcon={<i className='ri-download-line' />}>
                                Export
                            </Button>
                            <Button variant='contained' startIcon={<i className='ri-add-line' />} onClick={() => setOpenAdd(true)}>
                                Add
                            </Button>
                        </Box>
                    )}
                </Box>
            </Box>
            <Drawer anchor='right' open={openAdd} onClose={() => setOpenAdd(false)} keepMounted>
                <Box sx={{ width: { xs: '100vw', sm: 480, md: 520 }, p: 3, '& .MuiTextField-root': { mb: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant='h6' color='text.primary'>
                            Add an Associate
                        </Typography>
                        <IconButton onClick={() => setOpenAdd(false)} aria-label='Close add associate'>
                            <i className='ri-close-line' />
                        </IconButton>
                    </Box>
                    <AssociatesCreateForm
                        showTitle={false}
                        redirectOnSuccess
                        onSuccess={() => {
                            setOpenAdd(false)
                            refresh()
                        }}
                        onCancel={() => setOpenAdd(false)}
                    />
                </Box>
            </Drawer>
            {isMobile ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {loading ? (
                        <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                            <CardContent sx={{ p: 2 }}>
                                <Typography variant='body2' color='text.secondary'>
                                    Loading...
                                </Typography>
                            </CardContent>
                        </Card>
                    ) : associates.length === 0 ? (
                        <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                            <CardContent sx={{ p: 2 }}>
                                <Typography variant='body2' color='text.secondary'>
                                    No associates found
                                </Typography>
                            </CardContent>
                        </Card>
                    ) : (
                        associates.map(a => {
                            return (
                                <Card
                                    key={a.id}
                                    sx={{
                                        borderRadius: 3,
                                        boxShadow: 'none',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        backgroundColor: 'background.paper'
                                    }}
                                >
                                    <CardContent sx={{ p: 2 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                            <Avatar
                                                sx={{
                                                    width: 36,
                                                    height: 36,
                                                    bgcolor: 'primary.light',
                                                    color: 'primary.contrastText',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 600
                                                }}
                                                aria-label={`${a.associateName} avatar`}
                                            >
                                                {a.associateName
                                                    .split(' ')
                                                    .filter(Boolean)
                                                    .slice(0, 2)
                                                    .map(s => s[0]?.toUpperCase())
                                                    .join('')}
                                            </Avatar>
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                                                    <MuiLink
                                                        component={Link}
                                                        href={`/associates/${a.id}`}
                                                        underline='hover'
                                                        color='text.primary'
                                                        sx={{
                                                            fontSize: '1rem',
                                                            fontWeight: 600,
                                                            display: 'block',
                                                            textOverflow: 'ellipsis',
                                                            overflow: 'hidden',
                                                            whiteSpace: 'nowrap',
                                                            transition: 'color .2s ease',
                                                            '&:hover': {
                                                                color: 'primary.main'
                                                            }
                                                        }}
                                                    >
                                                        {a.associateName}
                                                    </MuiLink>
                                                    {a.code ? (
                                                        <Typography
                                                            component='sup'
                                                            variant='caption'
                                                            color='primary.main'
                                                            sx={{
                                                                fontWeight: 700,
                                                                borderRadius: 999,
                                                                px: 0.75,
                                                                py: 0.15,
                                                                backgroundColor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.12)',
                                                                lineHeight: 1
                                                            }}
                                                        >
                                                            {a.code}
                                                        </Typography>
                                                    ) : null}
                                                </Box>
                                                <Box className='flex items-center gap-1.5'>
                                                    <i className='ri-smartphone-line text-base' />
                                                    <Typography variant='body2'>
                                                        {[a.countryCode, a.mobile].filter(Boolean).join(' ')}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Box>
                                        <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                                            {a.companyName}
                                        </Typography>
                                        <Typography variant='caption' color='text.secondary'>
                                            Type: {a.associateTypeName || '-'}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            )
                        })
                    )}
                </Box>
            ) : (
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Associate Name</TableCell>
                            <TableCell>Code</TableCell>
                            <TableCell>Company Name</TableCell>
                            <TableCell>Country Code - Mobile Number</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>Payout (%)</TableCell>
                            <TableCell>IsActive</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={9}>Loading...</TableCell>
                            </TableRow>
                        ) : associates.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9}>No associates found</TableCell>
                            </TableRow>
                        ) : (
                            associates.map(a => (
                                <TableRow key={a.id}>
                                    <TableCell>
                                        <Box className='flex items-center gap-2'>
                                            <Avatar
                                                sx={{
                                                    width: 32,
                                                    height: 32,
                                                    bgcolor: 'primary.light',
                                                    color: 'primary.contrastText',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 600
                                                }}
                                                aria-label={`${a.associateName} avatar`}
                                            >
                                                {a.associateName
                                                    .split(' ')
                                                    .filter(Boolean)
                                                    .slice(0, 2)
                                                    .map(s => s[0]?.toUpperCase())
                                                    .join('')}
                                            </Avatar>
                                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                <MuiLink
                                                    component={Link}
                                                    href={`/associates/${a.id}`}
                                                    underline='hover'
                                                    color='text.primary'
                                                    sx={{
                                                        fontSize: '0.95rem',
                                                        fontWeight: 500,
                                                        transition: 'color .2s ease',
                                                        '&:hover': {
                                                            color: 'primary.main'
                                                        }
                                                    }}
                                                >
                                                    {a.associateName}
                                                </MuiLink>
                                            </Box>
                                        </Box>
                                    </TableCell>
                                    <TableCell>{a.code || '-'}</TableCell>
                                    <TableCell>{a.companyName}</TableCell>
                                    <TableCell>
                                        <Box className='flex items-center gap-1.5'>
                                            <i className='ri-smartphone-line text-lg' />
                                            <span>{[a.countryCode, a.mobile].filter(Boolean).join(' ')}</span>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Box className='flex items-center gap-1.5'>
                                            <i className='ri-mail-line text-lg' />
                                            <span>{a.email || '-'}</span>
                                        </Box>
                                    </TableCell>
                                    <TableCell>{a.payout != null ? `${a.payout}%` : '-'}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={a.isActive ? 'Active' : 'Inactive'}
                                            size='small'
                                            variant='outlined'
                                            sx={{
                                                boxShadow: 'none',
                                                borderColor: a.isActive
                                                    ? 'rgb(var(--mui-palette-success-mainChannel) / 0.5)'
                                                    : 'rgb(var(--mui-palette-error-mainChannel) / 0.5)',
                                                color: a.isActive ? 'success.main' : 'error.main',
                                                backgroundColor: a.isActive
                                                    ? 'rgb(var(--mui-palette-success-mainChannel) / 0.08)'
                                                    : 'rgb(var(--mui-palette-error-mainChannel) / 0.08)'
                                            }}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            )}
            {isMobile && !openAdd ? (
                <Fab
                    color='primary'
                    aria-label='Add associate'
                    onClick={() => setOpenAdd(true)}
                    sx={{
                        position: 'fixed',
                        bottom: 24,
                        right: 20,
                        zIndex: theme.zIndex.drawer + 1,
                        boxShadow: '0 14px 30px rgb(0 0 0 / 0.2)'
                    }}
                >
                    <i className='ri-add-line text-2xl' />
                </Fab>
            ) : null}
        </Box>
    )
}

export default AssociatesList
